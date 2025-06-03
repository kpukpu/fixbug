import numpy as np
import pandas as pd
import time
import tensorflow as tf

from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input, ConvLSTM2D, BatchNormalization, Conv2D
from tensorflow.keras.optimizers import Adam

from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    accuracy_score, precision_score, recall_score
)

def focal_binary_loss(gamma=2.0, alpha=0.25):
    def loss_fn(y_true, y_pred):
        y_pred = tf.clip_by_value(y_pred, 1e-4, 1.0 - 1e-4)
        cross_entropy = - (y_true * tf.math.log(y_pred) + (1-y_true) * tf.math.log(1-y_pred))
        p_t = y_true * y_pred + (1-y_true)*(1-y_pred)
        modulating = tf.pow(1 - p_t, gamma)
        alpha_factor = y_true * alpha + (1-y_true)*(1-alpha)
        return tf.reduce_mean(alpha_factor * modulating * cross_entropy)
    return loss_fn

if __name__ == '__main__':
    # 1) Load preprocessed tensors
    data = np.load('convLSTM_data.npz')
    X, Y_reg = data['X'], data['Y']
    Y_cls   = (Y_reg > 0).astype('float32')
    print(f"Loaded X{X.shape}, Y_reg{Y_reg.shape}")

    # 2) Split train / eval
    N = X.shape[0]
    X_train,  X_eval   = X[:N-12], X[N-12:]
    Y_reg_tr, Y_reg_ev = Y_reg[:N-12], Y_reg[N-12:]
    Y_cls_tr, Y_cls_ev = Y_cls[:N-12], Y_cls[N-12:]
    print(f"Train samples={X_train.shape[0]}, Eval samples={X_eval.shape[0]}")

    # 3) Random minority oversampling
    pos_idx = [i for i in range(len(X_train)) if Y_cls_tr[i].sum() > 0]
    replicate_times = 3
    X_pos     = X_train[pos_idx]
    Y_reg_pos = Y_reg_tr[pos_idx]
    Y_cls_pos = Y_cls_tr[pos_idx]

    X_rep     = np.concatenate([X_pos]*replicate_times,     axis=0)
    Y_reg_rep = np.concatenate([Y_reg_pos]*replicate_times, axis=0)
    Y_cls_rep = np.concatenate([Y_cls_pos]*replicate_times, axis=0)

    X_train_bal     = np.concatenate([X_train,   X_rep],     axis=0)
    Y_reg_train_bal = np.concatenate([Y_reg_tr, Y_reg_rep],  axis=0)
    Y_cls_train_bal = np.concatenate([Y_cls_tr, Y_cls_rep],  axis=0)

    perm = np.random.permutation(len(X_train_bal))
    X_train_bal     = X_train_bal[perm]
    Y_reg_train_bal = Y_reg_train_bal[perm]
    Y_cls_train_bal = Y_cls_train_bal[perm]

    print(f"After oversampling → total train samples: {len(X_train_bal)}, positives: {len(pos_idx)*(1+replicate_times)}")

    # 4) Build model
    inp = Input(shape=X_train.shape[1:], name='input_seq')
    x = ConvLSTM2D(64, (3,3), padding='same', return_sequences=True)(inp)
    x = BatchNormalization()(x)
    x = ConvLSTM2D(32, (3,3), padding='same', return_sequences=False)(x)
    x = BatchNormalization()(x)
    reg_out = Conv2D(1, (1,1), activation='relu',    padding='same', name='reg')(x)
    cls_out = Conv2D(1, (1,1), activation='sigmoid', padding='same', name='cls')(x)
    model = Model(inputs=inp, outputs=[reg_out, cls_out])
    opt = Adam(learning_rate=5e-5, clipnorm=1.0)
    model.compile(
        optimizer=opt,
        loss={'reg':'mse', 'cls': focal_binary_loss()},
        loss_weights={'reg':1.0, 'cls':10.0}
    )
    model.summary()

    # 5) Train
    print("Training …")
    t0 = time.time()
    history = model.fit(
        X_train_bal,
        {'reg':Y_reg_train_bal, 'cls':Y_cls_train_bal},
        validation_data=(X_eval, {'reg':Y_reg_ev, 'cls':Y_cls_ev}),
        epochs=20,
        batch_size=4,
        verbose=1
    )
    print(f"Training completed in {time.time()-t0:.1f}s")

    # 6) Predict
    Y_pred_reg, Y_pred_cls = model.predict(X_eval)
    Y_pred_reg = Y_pred_reg[...,0]
    Y_pred_cls = Y_pred_cls[...,0]
    Y_true_reg = Y_reg_ev[...,0]
    Y_true_cls = Y_cls_ev[...,0].astype(int)

    # 7) Metrics
    print("\n2020 Metrics per Month:")
    for i in range(12):
        yt_r, yp_r = Y_true_reg[i].ravel(), Y_pred_reg[i].ravel()
        yt_c = Y_true_cls[i].ravel()
        yp_c = (Y_pred_cls[i].ravel()>=0.5).astype(int)
        print(f" Month {i+1:2d}: "
              f"MSE={mean_squared_error(yt_r,yp_r):.4f}, "
              f"MAE={mean_absolute_error(yt_r,yp_r):.4f}, "
              f"R2={r2_score(yt_r,yp_r):.3f}  |  "
              f"Acc={accuracy_score(yt_c,yp_c):.3f}, "
              f"Prec={precision_score(yt_c,yp_c,zero_division=0):.3f}, "
              f"Rec={recall_score(yt_c,yp_c,zero_division=0):.3f}")

    # 8) Export per‐grid CSV for 2020
    unique = pd.read_csv('grid_meta.csv', encoding='utf-8-sig')
    months = [f"2020-{m:02d}" for m in range(1,13)]
    H, W = Y_true_reg.shape[1], Y_true_reg.shape[2]

    records = []
    for mi, month in enumerate(months):
        rec = pd.DataFrame({
            'year_month': month,
            'grid_idx':   np.arange(H*W),
            'true_reg':   Y_true_reg[mi].ravel(),
            'pred_reg':   Y_pred_reg[mi].ravel(),
            'true_cls':   Y_true_cls[mi].ravel(),
            'pred_cls':   (Y_pred_cls[mi].ravel()>=0.5).astype(int),
            'score_cls':  Y_pred_cls[mi].ravel()
        })
        rec = rec.merge(unique, on='grid_idx', how='left')
        records.append(rec)

    out = pd.concat(records, ignore_index=True)
    out.to_csv('multitask_predictions_2020.csv', index=False, encoding='utf-8-sig')
    print("Saved → multitask_predictions_2020.csv")
