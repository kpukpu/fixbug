# train_convlstm_balanced.py

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from tensorflow.keras.utils import Sequence
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Input, ConvLSTM2D, TimeDistributed, Dense
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint

# 1) Load preprocessed ConvLSTM arrays
X = np.load('X_clstm.npy', allow_pickle=True).astype('float32')  # (n_grids, T, 1, 1, C)
y = np.load('y_clstm.npy', allow_pickle=True).astype('int8')    # (n_grids, T)
y = y.reshape((y.shape[0], y.shape[1], 1, 1, 1))                 # (n_grids, T, 1, 1, 1)

# 2) Split into train/validation
X_train, X_val, y_train, y_val = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# 3) Balanced batch generator
class BalancedBatchGenerator(Sequence):
    def __init__(self, X, y, batch_size=32, pos_to_neg_ratio=(1,2)):
        self.X, self.y = X, y
        # Label a sequence positive if any timestep is 1
        seq_labels = (y.reshape(y.shape[0], -1).sum(axis=1) > 0)
        self.pos_idx = np.where(seq_labels)[0]
        self.neg_idx = np.where(~seq_labels)[0]
        self.bs = batch_size
        n_pos, n_neg = pos_to_neg_ratio
        total = n_pos + n_neg
        self.n_pos = max(1, (batch_size * n_pos) // total)
        self.n_neg = batch_size - self.n_pos

    def __len__(self):
        return int(np.ceil(len(self.pos_idx) * (self.n_pos + self.n_neg) / self.bs))

    def __getitem__(self, idx):
        pos = np.random.choice(self.pos_idx, self.n_pos)
        neg = np.random.choice(self.neg_idx, self.n_neg)
        batch_idx = np.concatenate([pos, neg])
        np.random.shuffle(batch_idx)
        return self.X[batch_idx], self.y[batch_idx]

# 4) Instantiate generator with 1:3 ratio
gen = BalancedBatchGenerator(X_train, y_train, batch_size=32, pos_to_neg_ratio=(1,2))

# 5) Build ConvLSTM model
T, _, _, C = X.shape[1:]
model = Sequential([
    Input(shape=(T, 1, 1, C)),
    ConvLSTM2D(16, (1,1), return_sequences=True, activation='tanh'),
    TimeDistributed(Dense(1, activation='sigmoid'))
])
model.compile(
    optimizer='adam',
    loss='binary_crossentropy',
    metrics=['accuracy']
)
model.summary()

# 6) Callbacks
callbacks = [
    EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True),
    ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, min_lr=1e-6),
    ModelCheckpoint('convlstm_balanced_best.h5', monitor='val_loss', save_best_only=True)
]

# 7) Train
history = model.fit(
    gen,
    validation_data=(X_val, y_val),
    epochs=50,
    callbacks=callbacks
)

# 8) Save final model
model.save('convlstm_balanced_final.h5')
print("Saved models: convlstm_balanced_best.h5, convlstm_balanced_final.h5")
