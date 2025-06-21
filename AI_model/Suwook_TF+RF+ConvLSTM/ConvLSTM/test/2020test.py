# build_testset_2020.py

import pandas as pd
import numpy as np
import re
import joblib

# 1) 원본 파일 로드
space     = pd.read_excel('공간.xlsx')
time_df   = pd.read_excel('시계열.xlsx')
test_flag = pd.read_csv('20월별정답.csv', encoding='utf-8-sig')

# 2) 시계열 '년월' → '년', '월' 분리
time_df['년'] = time_df['년월'].str[:2].astype(int) + 2000
time_df['월'] = time_df['년월'].str[3:5].astype(int)

# 3) 정적 공간 피처 목록 (train 때와 동일하게)
pattern_train   = re.compile(r'민원 발생 여부_(1[5-9])_(0[6-9]|10)$')
flag_cols_train = [c for c in space.columns if pattern_train.match(c)]
static_cols     = [
    c for c in space.columns
    if c not in flag_cols_train
    and c != '격자100m'
    and np.issubdtype(space[c].dtype, np.number)
]

# 4) 2020년 정답 CSV에서 플래그 컬럼 식별
pattern_test   = re.compile(r'민원 발생 여부_20_(0[6-9]|10)$')
flag_cols_test = [c for c in test_flag.columns if pattern_test.match(c)]
print(">> test_flag 플래그 컬럼:", flag_cols_test)

# 5) melt → long 포맷으로 변환
space_test = test_flag.melt(
    id_vars=['격자100m'],
    value_vars=flag_cols_test,
    var_name='년월_flag',
    value_name='target'
)
space_test['년'] = 2020
space_test['월'] = space_test['년월_flag'].str[-2:].astype(int)
print(">> space_test 샘플:\n", space_test.head())

# 6) 2020년 시계열 데이터 필터링
time_test = time_df[
    (time_df['년'] == 2020) &
    (time_df['월'].isin([6,7,8,9,10]))
].copy()
print(">> time_test 샘플:\n", time_test.head())

# 7) ID 컬럼 타입 문자열로 통일
space_test['격자100m'] = space_test['격자100m'].astype(str)
static_df = space[['격자100m'] + static_cols].copy()
static_df['격자100m'] = static_df['격자100m'].astype(str)

# 8) merge: space_test → static_df → time_test
merged_test = (
    space_test
    .merge(static_df, on='격자100m', how='left')
    .merge(time_test, on=['년','월'], how='inner')
)
print(">> merged_test shape:", merged_test.shape)

# 9) ML 테스트셋 저장
time_feats   = [c for c in time_test.columns if c not in ['년월','년','월']]
X_test_ml    = merged_test[static_cols + time_feats].astype('float32')
y_test_ml    = merged_test['target'].astype('int8')
meta_test_ml = merged_test[['격자100m','년','월']]

meta_test_ml.to_csv('meta_test_ml.csv', index=False, encoding='utf-8-sig')
X_test_ml.to_csv('X_test_ml.csv',     index=False, encoding='utf-8-sig')
y_test_ml.to_frame('target').to_csv('y_test_ml.csv', index=False, encoding='utf-8-sig')
joblib.dump((X_test_ml, y_test_ml), 'ml_test_dataset.pkl')

# 10) ConvLSTM 테스트셋 저장
grids          = merged_test['격자100m'].unique()
np.save('grids_test.npy', grids)

T              = merged_test['년월_flag'].nunique()
static_arr     = merged_test.groupby('격자100m')[static_cols].first().loc[grids].values.astype('float32')
time_arr       = np.stack([
    merged_test[merged_test['격자100m']==g]
               .sort_values(['년','월'])[time_feats]
               .values.astype('float32')
    for g in grids
], axis=0)
static_exp     = np.repeat(static_arr[:, None, :], T, axis=1)
X_test_clstm   = np.concatenate([static_exp, time_arr], axis=2)
X_test_clstm   = X_test_clstm.reshape(len(grids), T, 1, 1, -1)
y_test_clstm   = np.stack([
    merged_test[merged_test['격자100m']==g]
               .sort_values(['년','월'])['target']
               .values
    for g in grids
], axis=0).astype('int8')

np.save('X_test_clstm.npy', X_test_clstm)
np.save('y_test_clstm.npy', y_test_clstm)

print("✅ 2020년 테스트셋 저장 완료")
