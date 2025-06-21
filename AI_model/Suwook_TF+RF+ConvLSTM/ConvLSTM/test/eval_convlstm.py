# eval_convlstm.py

import numpy as np
from tensorflow.keras.models import load_model
from sklearn.metrics import classification_report, confusion_matrix

# 1) 로드
X_val = np.load('X_val_clstm.npy').astype('float32')
y_val = np.load('y_val_clstm.npy').astype('int8')  # (n_grids, T)

model = load_model('convlstm_balanced_best.h5', compile=False)

# 2) 예측 확률
y_prob = model.predict(X_val)     # (n_grids, T,1,1,1)
y_prob = y_prob.squeeze()         # (n_grids, T)

# 3) threshold 조정 (0.5 → 0.3)
threshold = 0.3
y_pred = (y_prob >= threshold).astype(int).flatten()
y_true = y_val.flatten()

# 4) 지표 출력
print("=== Classification Report ===")
print(classification_report(y_true, y_pred, digits=4))
print("=== Confusion Matrix ===")
print(confusion_matrix(y_true, y_pred))
