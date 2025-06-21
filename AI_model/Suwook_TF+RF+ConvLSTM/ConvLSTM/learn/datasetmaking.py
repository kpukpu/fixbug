import pandas as pd
import numpy as np
import re
import joblib

# 0) 파일 경로 설정 (필요에 따라 수정)
SPACE_PATH = r'C:\Users\이수욱\Desktop\공간.xlsx'
TIME_PATH  = r'C:\Users\이수욱\Desktop\시계열.xlsx'

# 1) 원본 데이터 로드
space   = pd.read_excel(SPACE_PATH)
time_df = pd.read_excel(TIME_PATH)

# 2) 시계열 '년월' → '년', '월'
time_df['년'] = time_df['년월'].str[:2].astype(int) + 2000
time_df['월'] = time_df['년월'].str[3:5].astype(int)

# 3) 공간 플래그 컬럼 식별 (2015~19년 6~10월)
pattern   = re.compile(r'민원 발생 여부_(1[5-9])_(0[6-9]|10)$')
flag_cols = [c for c in space.columns if pattern.match(c)]

# 4) 정적 공간 피처 정의 (숫자형만, ID 제외)
static_cols = [
    c for c in space.columns
    if c not in flag_cols
    and c != '격자100m'
    and np.issubdtype(space[c].dtype, np.number)
]

# 5) melt → long 포맷으로 변환 (target 플래그 포함)
space_long = space.melt(
    id_vars=['격자100m'] + static_cols,
    value_vars=flag_cols,
    var_name='년월_flag',
    value_name='target'
)
space_long['년'] = space_long['년월_flag'].str.extract(r'(\d{2})')[0].astype(int) + 2000
space_long['월'] = space_long['년월_flag'].str.extract(r'_(\d{2})$')[0].astype(int)

# 6) 시계열 학습 구간 필터링 (2015~19년, 6~10월)
time_train = time_df[
    (time_df['년'].between(2015, 2019)) &
    (time_df['월'].isin([6,7,8,9,10]))
].copy()

# 7) 공간 + 시계열 merge → merged_train
merged = space_long.merge(time_train, on=['년','월'], how='inner')

# 8) ML용 메타 정보 저장 (격자ID + 년 + 월)
meta_ml = merged[['격자100m','년','월']].reset_index(drop=True)
meta_ml.to_csv('meta_ml.csv', index=False, encoding='utf-8-sig')

# 9) 머신러닝용 데이터셋 준비 및 저장
time_feats = [c for c in time_train.columns if c not in ['년월','년','월']]
X_ml = merged[static_cols + time_feats].astype('float32')
y_ml = merged['target'].astype('int8')
X_ml.to_csv('X_ml.csv', index=False, encoding='utf-8-sig')
y_ml.to_frame('target').to_csv('y_ml.csv', index=False, encoding='utf-8-sig')
joblib.dump((X_ml, y_ml), 'ml_dataset.pkl')

# 10) ConvLSTM용 데이터셋 준비 및 저장
grids = merged['격자100m'].unique()
np.save('grids.npy', grids)

T = merged['년월_flag'].nunique()  # 25
static_arr = merged.groupby('격자100m')[static_cols].first().loc[grids].values.astype('float32')
time_arr = np.stack([
    merged[merged['격자100m']==g]
          .sort_values(['년','월'])[time_feats].values.astype('float32')
    for g in grids
], axis=0)
static_exp = np.repeat(static_arr[:,None,:], T, axis=1)

X_clstm = np.concatenate([static_exp, time_arr], axis=2)
X_clstm = X_clstm.reshape(len(grids), T, 1, 1, -1)
y_clstm = np.stack([
    merged[merged['격자100m']==g]
          .sort_values(['년','월'])['target'].values
    for g in grids
], axis=0).astype('int8')

np.save('X_clstm.npy', X_clstm)
np.save('y_clstm.npy', y_clstm)

print("전처리 완료:")
print(" - meta_ml.csv")
print(" - X_ml.csv, y_ml.csv, ml_dataset.pkl")
print(" - grids.npy, X_clstm.npy, y_clstm.npy")
