# prepare_transformer.py

import pandas as pd
import numpy as np
import re
from numpy.lib.stride_tricks import sliding_window_view
from math import ceil

# 1) Load static & dynamic
static_df = pd.read_excel('data1.xlsx')   # 정적 피처
dyn_df    = pd.read_excel('data2.xlsx')   # wide-format 동적 피처

id_cols = ['격자100m','위도','경도']

# 2) Static feature list
static_cols = [c for c in static_df.columns if c not in id_cols]

# 3) Melt dynamic—“월별” 피처만
monthly_pattern = re.compile(r'.*_\d{2}_\d{2}$')
melt_cols = [c for c in dyn_df.columns if monthly_pattern.match(c)]
panel_dyn = (
    dyn_df
    .melt(id_vars=id_cols, value_vars=melt_cols,
          var_name='orig', value_name='value')
)
# 4) 분리해서 year_month, feature 컬럼 생성
panel_dyn['feature'] = panel_dyn['orig'].str.rsplit('_', n=2).str[0]
panel_dyn['year_month'] = (
    panel_dyn['orig']
    .str.extract(r'_(\d{2})_(\d{2})$')
    .apply(lambda row: f"20{row[0]}-{row[1]}", axis=1)
)
panel_dyn = panel_dyn.drop(columns='orig')

# 5) pivot so each row=(격자,year_month), columns=feature, values=value
panel_dyn = (
    panel_dyn
    .pivot_table(index=id_cols + ['year_month'],
                 columns='feature',
                 values='value',
                 fill_value=0)
    .reset_index()
)
dyn_feats = [c for c in panel_dyn.columns if c not in id_cols + ['year_month']]

# 6) grid metadata & static attach
grid_meta = (
    static_df[id_cols]
    .drop_duplicates()
    .reset_index(drop=True)
)
grid_meta['grid_idx'] = np.arange(len(grid_meta))
grid_meta = grid_meta.merge(
    static_df[id_cols + static_cols].drop_duplicates(),
    on=id_cols, how='left'
)

# 7) space–time skeleton 생성
all_times = sorted(panel_dyn['year_month'].unique())
H = W = ceil(np.sqrt(len(grid_meta)))
full_space = (
    pd.DataFrame({'grid_idx': np.arange(H*W)})
    .merge(grid_meta, on='grid_idx', how='left')
)
full_space[static_cols] = full_space[static_cols].fillna(0)

full_time  = pd.DataFrame({'year_month': all_times})
full_index = full_time.merge(full_space, how='cross')

# 8) dynamic 값 병합, 결측은 0으로
lookup = panel_dyn.merge(
    grid_meta[id_cols + ['grid_idx']],
    on=id_cols, how='left'
)[['grid_idx','year_month'] + dyn_feats]

full = full_index.merge(
    lookup, on=['grid_idx','year_month'], how='left'
)
full[dyn_feats] = full[dyn_feats].fillna(0)

# 9) integer time_idx 매핑
time_to_idx = {tm:i for i,tm in enumerate(all_times)}
full['time_idx'] = full['year_month'].map(time_to_idx)

# 10) 정렬 & array 변환 (T, N, C)
full = full.sort_values(['time_idx','grid_idx']).reset_index(drop=True)
T = len(all_times)
N = H*W
C_total  = len(static_cols) + len(dyn_feats)

arr  = full[['time_idx','grid_idx'] + static_cols + dyn_feats]
vals = arr[static_cols + dyn_feats].to_numpy(dtype=np.float32)
data = vals.reshape(T, N, C_total)

# 11) sliding window (K=12) →  X:(T-K, K, N, C), Y:(T-K, N)
K = 12
# 수정된 부분: squeeze 제거
X_full = sliding_window_view(data, window_shape=K, axis=0)  # (T-K+1, K, N, C)
X = X_full[:-1]                                            # drop 마지막 윈도우 → (T-K, K, N, C)

# 다음 달 민원수 발생 여부(Y)를 0/1 로
Y_full = data[..., dyn_feats.index('민원수')]              # (T, N)
Y_bin  = (Y_full > 0).astype(np.int64)                     # (T, N)
Y      = Y_bin[1:]                                         # (T-1, N)
Y      = Y[K-1:]                                           # (T-K, N)

# 12) 저장
np.savez_compressed(
    'transformer_data.npz',
    X=X,
    Y=Y,
    H=H, W=W,
    static_cols=static_cols,
    dyn_feats=dyn_feats
)
grid_meta[['grid_idx','격자100m','위도','경도']].to_csv(
    'grid_meta.csv', index=False, encoding='utf-8-sig'
)

print("✅ prepare_transformer complete")
print(f"T-K={X.shape[0]}, K={K}, N={N}, C_total={C_total}")
print(f"X.shape={X.shape}, Y.shape={Y.shape}")
