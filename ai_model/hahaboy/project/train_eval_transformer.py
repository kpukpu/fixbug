# train_eval_transformer.py

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import pandas as pd

from torch.utils.data import TensorDataset, DataLoader
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

class TransformerClassifier(nn.Module):
    def __init__(self, feat_dim, seq_len, d_model=64, nhead=4, num_layers=2, dropout=0.1):
        super().__init__()
        self.input_proj = nn.Linear(feat_dim, d_model)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dropout=dropout, batch_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.classifier = nn.Linear(d_model, 1)
    
    def forward(self, x):
        # x: (batch, seq_len, feat_dim)
        x = self.input_proj(x)                     # → (batch, seq_len, d_model)
        x = self.transformer(x)                    # → (batch, seq_len, d_model)
        last = x[:, -1, :]                         # → (batch, d_model)
        out = torch.sigmoid(self.classifier(last)) # → (batch, 1)
        return out.view(-1)                        # → (batch,)

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # 1) NPZ 읽기
    data = np.load("transformer_data.npz", allow_pickle=True)
    X = data["X"]   # (windows, N, C, K)
    Y = data["Y"]   # (windows, N)
    H, W = int(data["H"]), int(data["W"])

    # 2) 차원 재배열 → (windows, N, K, C)
    X = np.transpose(X, (0,1,3,2))
    windows, N, seq_len, feat_dim = X.shape

    # 3) flatten → (windows*N, seq_len, feat_dim), (windows*N,)
    X_flat = X.reshape(windows*N, seq_len, feat_dim)
    Y_flat = Y.reshape(windows*N)

    # 4) 학습/평가 분할 (마지막 12 윈도우는 2020년 예측용)
    num_eval_windows  = 12
    num_train_windows = windows - num_eval_windows
    train_size = num_train_windows * N

    # 5) “예측 월(month_of_pred)” 계산 (1월=1 … 12월=12)
    #    첫 번째 Y_flat block(window 0) 은 time_idx=K (13번째 달) 예측 → month = (K mod 12)+1
    K = 12
    month_of_pred = ((np.arange(windows) + K) % 12) + 1  # length = windows

    # 6) 6–10월만 선택하도록 마스크 생성
    train_mask_windows = np.isin(month_of_pred[:num_train_windows], [6,7,8,9,10])
    eval_mask_windows  = np.isin(month_of_pred[num_train_windows:], [6,7,8,9,10])
    # → 길이 num_train_windows, num_eval_windows

    # 7) flat 단위로 확장
    train_mask = np.repeat(train_mask_windows, N)
    eval_mask  = np.repeat(eval_mask_windows,  N)

    X_train = X_flat[:train_size][train_mask]
    Y_train = Y_flat[:train_size][train_mask]
    X_eval  = X_flat[train_size:][eval_mask]
    Y_eval  = Y_flat[train_size:][eval_mask]

    print(f"Train samples={len(Y_train)}, Eval samples={len(Y_eval)}  (6–10월만)")

    # 8) 피처 스케일링
    scaler = StandardScaler()
    X_train_2d = X_train.reshape(-1, feat_dim)
    scaler.fit(X_train_2d)
    X_train = scaler.transform(X_train_2d).reshape(-1, seq_len, feat_dim)
    X_eval  = scaler.transform(X_eval.reshape(-1, feat_dim)).reshape(-1, seq_len, feat_dim)

    # 9) DataLoader
    batch_size = 256
    train_ds = TensorDataset(torch.from_numpy(X_train).float(),
                             torch.from_numpy(Y_train).float())
    eval_ds  = TensorDataset(torch.from_numpy(X_eval).float(),
                             torch.from_numpy(Y_eval).float())
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True,  num_workers=4)
    eval_loader  = DataLoader(eval_ds,  batch_size=batch_size, shuffle=False, num_workers=4)

    # 10) 모델·손실·최적화
    model = TransformerClassifier(feat_dim, seq_len).to(device)
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=1e-3)

    # 11) 학습
    epochs = 10
    for epoch in range(1, epochs+1):
        model.train()
        total_loss = 0.0
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            pred = model(xb)
            loss = criterion(pred, yb)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * xb.size(0)
        avg_loss = total_loss / len(train_loader.dataset)

        # 평가 (threshold=0.5)
        model.eval()
        all_preds, all_trues = [], []
        with torch.no_grad():
            for xb, yb in eval_loader:
                xb = xb.to(device)
                out = model(xb).cpu().numpy()
                all_preds.append(out); all_trues.append(yb.numpy())
        all_preds = np.concatenate(all_preds)
        all_trues = np.concatenate(all_trues)
        preds_bin = (all_preds >= 0.5).astype(int)

        acc  = accuracy_score(all_trues, preds_bin)
        prec = precision_score(all_trues, preds_bin, zero_division=0)
        rec  = recall_score(all_trues, preds_bin, zero_division=0)
        f1   = f1_score(all_trues, preds_bin, zero_division=0)
        print(f"Epoch {epoch}/{epochs}  TrainLoss={avg_loss:.4f}  "
              f"Eval Acc={acc:.4f}  Prec={prec:.4f}  Rec={rec:.4f}  F1={f1:.4f}")

    # 12) 임계값 튜닝
    best_thr, best_f1 = 0.5, 0.0
    for thr in np.linspace(0.1, 0.9, 81):
        p = (all_preds >= thr).astype(int)
        f1_ = f1_score(all_trues, p, zero_division=0)
        if f1_ > best_f1:
            best_f1, best_thr = f1_, thr
    print(f"\nOptimal threshold={best_thr:.2f}, F1={best_f1:.4f}")

    # 13) 월별(6–10월) 지표 출력
    # (필터링 했으므로 따로 월별 분리 없이 전체 성능만 보임)

if __name__ == "__main__":
    main()
