# filename: kfold_transformer_tabular.py
import argparse, os, logging, random, yaml, time
from datetime import datetime
from collections import OrderedDict

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import (accuracy_score, f1_score,
                             classification_report, confusion_matrix)

import matplotlib.pyplot as plt
import seaborn as sns


# ---------- Data -----------------------------------------------------------------
class CSVDataset:
    """단순 CSV 로더 – scaling은 fold 내부에서 수행"""
    def __init__(self, csv_file):
        df = pd.read_csv(csv_file)
        df.columns = df.columns.str.strip()

        self.grid_ids = df['격자100m'].values
        df = df.drop(['격자100m', '위도', '경도'], axis=1)

        self.labels = df['민원_발생여부_All'].values
        df = df.drop('민원_발생여부_All', axis=1)

        # 결측치 제거
        nan_mask = ~np.isnan(df).any(axis=1)
        self.features = df.values[nan_mask].astype(np.float32)
        self.labels   = self.labels[nan_mask].astype(np.int64)
        self.grid_ids = self.grid_ids[nan_mask]
        self.feature_names = df.columns.tolist()

# ---------- Model ----------------------------------------------------------------
class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=1):
        super().__init__()
        self.register_buffer('pe', torch.zeros(1, max_len, d_model))

    def forward(self, x):     # seq_len == 1
        return x + self.pe[:, :x.size(1)]

class TransformerClassifier(nn.Module):
    def __init__(self, input_dim, hidden=128, heads=4, layers=2, dropout=0.1):
        super().__init__()
        self.embed = nn.Linear(input_dim, hidden)
        self.pos   = PositionalEncoding(hidden)
        enc_layer  = nn.TransformerEncoderLayer(d_model=hidden, nhead=heads,
                                                dim_feedforward=hidden*4,
                                                dropout=dropout,
                                                activation='relu')
        self.encoder = nn.TransformerEncoder(enc_layer, num_layers=layers)
        self.cls_head = nn.Sequential(
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden, 1)     # binary logit
        )

    def forward(self, x):                 # x: [B, F]
        x = self.embed(x).unsqueeze(1)    # [B, 1, H]
        x = self.pos(x).permute(1,0,2)    # [1, B, H]
        z = self.encoder(x).mean(dim=0)   # [B, H]
        return self.cls_head(z).squeeze(1)  # [B]

# ---------- Utils ----------------------------------------------------------------
class AverageMeter:
    def __init__(self): self.reset()
    def reset(self):
        self.sum = self.count = 0
    def update(self, val, n=1):
        self.sum += val * n
        self.count += n
    @property
    def avg(self): return 0 if self.count==0 else self.sum/self.count

def set_seed(seed=42):
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed); torch.backends.cudnn.deterministic = True

# ---------- Train / Validate -----------------------------------------------------
def train_one_epoch(model, loader, optim, loss_fn, device):
    model.train(); meter = AverageMeter()
    for x,y in loader:
        x,y = x.to(device), y.float().to(device)
        optim.zero_grad()
        loss = loss_fn(model(x), y)
        loss.backward(); optim.step()
        meter.update(loss.item(), x.size(0))
    return meter.avg

def validate(model, loader, loss_fn, device):
    model.eval(); meter = AverageMeter()
    all_pred, all_true = [], []
    with torch.no_grad():
        for x,y in loader:
            x,y = x.to(device), y.float().to(device)
            logits = model(x)
            loss = loss_fn(logits, y); meter.update(loss.item(), x.size(0))
            preds = (torch.sigmoid(logits) >= 0.5).long()
            all_pred.extend(preds.cpu().numpy()); all_true.extend(y.cpu().numpy())
    acc = accuracy_score(all_true, all_pred)
    f1_0, f1_1 = f1_score(all_true, all_pred, labels=[0,1], average=None, zero_division=0)
    return meter.avg, acc, f1_0, f1_1

# ---------- K‑Fold ---------------------------------------------------------------
def kfold_run(dataset, args):
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=args.seed)
    results = {'acc':[], 'f1_0':[], 'f1_1':[]}

    for fold, (train_idx, val_idx) in enumerate(skf.split(dataset.features, dataset.labels), 1):
        print(f'\n===== Fold {fold} =====')

        # Split
        X_train, y_train = dataset.features[train_idx], dataset.labels[train_idx]
        X_val,   y_val   = dataset.features[val_idx],   dataset.labels[val_idx]

        # Scaling (train‑only fit)
        scaler = StandardScaler().fit(X_train)
        X_train = scaler.transform(X_train).astype(np.float32)
        X_val   = scaler.transform(X_val).astype(np.float32)

        # Dataloader
        tr_loader = DataLoader(TensorDataset(torch.tensor(X_train), torch.tensor(y_train)),
                               batch_size=args.batch_size, shuffle=True)
        va_loader = DataLoader(TensorDataset(torch.tensor(X_val), torch.tensor(y_val)),
                               batch_size=args.batch_size, shuffle=False)

        # Model & Optim
        model = TransformerClassifier(input_dim=X_train.shape[1],
                                      hidden=args.hidden, heads=4,
                                      layers=2, dropout=args.drop).to(args.device)
        optim = torch.optim.Adam(model.parameters(), lr=args.lr)
        loss_fn = nn.BCEWithLogitsLoss()

        # Train
        for epoch in range(args.epochs):
            tr_loss = train_one_epoch(model, tr_loader, optim, loss_fn, args.device)

        # Validate
        va_loss, acc, f1_0, f1_1 = validate(model, va_loader, loss_fn, args.device)
        print(f'Fold {fold} | Acc {acc:.4f} | F1‑0 {f1_0:.4f} | F1‑1 {f1_1:.4f}')
        results['acc'].append(acc); results['f1_0'].append(f1_0); results['f1_1'].append(f1_1)

        # (선택) 모델 저장
        save_dir = args.output; os.makedirs(save_dir, exist_ok=True)
        torch.save(model.state_dict(), os.path.join(save_dir, f'model_fold{fold}.pth'))

    # ----- Summary -----
    print('\n=== 5‑Fold Summary ===')
    for k,v in results.items():
        mean, std = np.mean(v), np.std(v)
        print(f'{k.upper()} : {mean:.4f} ± {std:.4f}')

# ---------- Main -----------------------------------------------------------------
def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--csv', default='train_oversampled.csv')
    p.add_argument('--batch-size', type=int, default=64)
    p.add_argument('--epochs', type=int, default=20)
    p.add_argument('--lr', type=float, default=1e-3)
    p.add_argument('--hidden', type=int, default=128)
    p.add_argument('--drop', type=float, default=0.1)
    p.add_argument('--seed', type=int, default=42)
    p.add_argument('--output', default='output')
    p.add_argument('--cpu', action='store_true')
    return p.parse_args()

def main():
    args = parse_args()
    set_seed(args.seed)
    args.device = torch.device('cpu' if args.cpu or not torch.cuda.is_available() else 'cuda')
    print('Device:', args.device)

    dataset = CSVDataset(args.csv)
    kfold_run(dataset, args)

if __name__ == '__main__':
    main()
