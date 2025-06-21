"""
train_convlstm_eval.py
────────────────────────────────────────────────────────
• X_clstm.npy / y_clstm.npy  : datasetmaking.py 결과
• 불균형 완화  : BalancedBatchGen(1:1) + focal-loss
• 모델        : ConvLSTM32  →  TimeDistributed(sigmoid)
• 끝나면      : X_val 에 대해 precision / recall / F1,  confusion matrix 출력
"""

import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
from tensorflow.keras.utils import Sequence
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Input, ConvLSTM2D, TimeDistributed, Dense
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint

# ──────────────────────────────────────────
# focal-loss (add-ons 없이) ----------------
# ──────────────────────────────────────────
def make_focal(alpha=0.25, gamma=2.0):
    def loss(y_true, y_pred):
        y_true = tf.cast(y_true, tf.float32)
        bce = tf.keras.backend.binary_crossentropy(y_true, y_pred)
        p_t = y_true * y_pred + (1. - y_true) * (1. - y_pred)
        mod = tf.pow(1. - p_t, gamma)
        alpha_fac = y_true * alpha + (1. - y_true) * (1. - alpha)
        return alpha_fac * mod * bce
    return loss
focal = make_focal()

# ──────────────────────────────────────────
# 0) 데이터 로드 ----------------------------
# ──────────────────────────────────────────
X = np.load("X_clstm.npy").astype("float32")      # (n,25,1,1,C)
y = np.load("y_clstm.npy").astype("int8")         # (n,25)
y = y.reshape((y.shape[0], y.shape[1], 1, 1, 1))  # (n,25,1,1,1)

# train / val split
X_tr, X_val, y_tr, y_val = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=(y.sum(axis=(1,2,3,4))>0)
)

# ──────────────────────────────────────────
# 1) 균형 배치 제너레이터 -------------------
# ──────────────────────────────────────────
class BalancedBatchGen(Sequence):
    def __init__(self, X, y, batch=32, ratio=(1,1)):
        self.X, self.y = X, y
        seq_pos = y.reshape(y.shape[0], -1).sum(1) > 0
        self.pos_idx = np.where(seq_pos)[0]
        self.neg_idx = np.where(~seq_pos)[0]
        p, n = ratio
        self.n_pos = max(1, batch * p // (p+n))
        self.n_neg = batch - self.n_pos
    def __len__(self): return int(np.ceil(len(self.pos_idx) / self.n_pos))
    def __getitem__(self, _):
        pos = np.random.choice(self.pos_idx, self.n_pos)
        neg = np.random.choice(self.neg_idx, self.n_neg)
        idx = np.concatenate([pos, neg]); np.random.shuffle(idx)
        return self.X[idx], self.y[idx]

gen = BalancedBatchGen(X_tr, y_tr, batch=32, ratio=(1,1))

# ──────────────────────────────────────────
# 2) 모델 ----------------------------------
# ──────────────────────────────────────────
T, C = X.shape[1], X.shape[-1]
model = Sequential([
    Input(shape=(T,1,1,C)),
    ConvLSTM2D(32, (1,1), activation="tanh", return_sequences=True),
    TimeDistributed(Dense(1, activation="sigmoid"))
])
model.compile(optimizer="adam", loss=focal, metrics=["accuracy"])
model.summary()

# ──────────────────────────────────────────
# 3) 콜백 ----------------------------------
# ──────────────────────────────────────────
callbacks = [
    EarlyStopping(monitor="val_loss", patience=7, restore_best_weights=True),
    ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=4, min_lr=1e-6),
    ModelCheckpoint("convlstm_best.h5", monitor="val_loss", save_best_only=True)
]

# ──────────────────────────────────────────
# 4) 학습 ----------------------------------
# ──────────────────────────────────────────
model.fit(gen, validation_data=(X_val, y_val),
          epochs=60, callbacks=callbacks)

model.save("convlstm_final.h5")
print("✅ 모델 저장 완료")

# ──────────────────────────────────────────
# 5) Validation 성능 확인 ------------------
# ──────────────────────────────────────────
#   ‣ 확률 → threshold 0.3 적용
#   ‣ 25-step 전체로 평가 (원한다면 마지막 5-step만 slice)
pred = model.predict(X_val)[:, :, 0, 0, 0]        # (n,25)

threshold = 0.30
y_pred = (pred >= threshold).astype(int)
y_true = y_val[:, :, 0, 0, 0]

# 전체 25-step flatten
y_true_flat = y_true.ravel()
y_pred_flat = y_pred.ravel()

print("\n=== Validation report (threshold = 0.30) ===")
from sklearn.metrics import classification_report, confusion_matrix
print(classification_report(y_true_flat, y_pred_flat, digits=4))
print("Confusion matrix:\n", confusion_matrix(y_true_flat, y_pred_flat))
