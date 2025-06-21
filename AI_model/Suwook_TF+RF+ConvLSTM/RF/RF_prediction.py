import pandas as pd, numpy as np, re
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier

# ---------- 0. 파일 경로 ----------
SPACE = '공간.xlsx'
TIME  = '시계열.xlsx'
TRUTH = '20년도정답.xlsx'

# ---------- 1. 데이터 로드 ----------
space = pd.read_excel(SPACE)
time  = pd.read_excel(TIME)

# ---------- 2. 라벨 melt ----------
pat = r'민원 발생 여부_(\d{2})_(0[6-9]|10)$'
target_cols = [c for c in space.columns if re.match(pat, c)]
melt = space.melt(id_vars=['격자100m'], value_vars=target_cols,
                  var_name='tmp', value_name='target')
melt[['year','month']] = melt['tmp'].str.extract(pat).astype(int)
melt = melt.drop(columns=['tmp'])

# ---------- 3. 시계열 병합 ----------
time['year']  = time['년월'].str[:2].astype(int)
time['month'] = time['년월'].str[3:5].astype(int)
time = time.drop(columns=['년월'])
data = melt.merge(time, on=['year','month'], how='left')

# ---------- 4. 피처 결합 ----------
static_cols = [c for c in space.columns if c not in target_cols+['격자100m']]
data = data.merge(space[['격자100m']+static_cols], on='격자100m', how='left')

# Lag feature
lag = data[['격자100m','year','month','target']].copy()
lag['year'] += 1
lag = lag.rename(columns={'target':'target_prev_year'})
data = data.merge(lag, on=['격자100m','year','month'], how='left')
data['target_prev_year'] = data['target_prev_year'].fillna(0)

# ---------- 5. 학습/테스트 분리 ----------
train = data[data['year'].isin([18,19])]
test  = data[data['year']==20]
features = [c for c in train.columns if c not in ['target','격자100m','year','month']]

imp = SimpleImputer(strategy='median')
X_train = imp.fit_transform(train[features])
y_train = train['target']

# Oversample minority 1:3
pos_idx = np.where(y_train==1)[0]
neg_idx = np.where(y_train==0)[0]
pos_target = len(neg_idx)//3
pos_resamp = np.random.choice(pos_idx, pos_target, replace=True)
sel = np.concatenate([neg_idx, pos_resamp])
X_bal, y_bal = X_train[sel], y_train.iloc[sel]

rf = RandomForestClassifier(n_estimators=1000, n_jobs=-1, random_state=42)
rf.fit(X_bal, y_bal)

X_test = imp.transform(test[features])
proba  = rf.predict_proba(X_test)[:,1]
test['pred_label'] = (proba >= 0.2).astype(int)

# ---------- 6. 1 km 확장 ----------
truth = pd.read_excel(TRUTH)
coords = truth[['격자100m','위도','경도']]
coords['lat_rad'] = np.radians(coords['위도'])
coords['lon_rad'] = np.radians(coords['경도'])

def haversine(lat1, lon1, l2, g2):
    R=6371000; dlat=l2-lat1; dlon=g2-lon1
    a=np.sin(dlat/2)**2+np.cos(lat1)*np.cos(l2)*np.sin(dlon/2)**2
    return 2*R*np.arcsin(np.sqrt(a))

radius=1000
pos = test[test['pred_label']==1]
rows=[]
for _, r in pos.iterrows():
    gid=r['격자100m']; m=r['month']
    center = coords[coords['격자100m']==gid]
    if center.empty: continue
    lat1, lon1 = center[['lat_rad','lon_rad']].values[0]
    dist = haversine(lat1, lon1, coords['lat_rad'].values, coords['lon_rad'].values)
    neighbor_ids = coords.loc[dist<=radius,'격자100m']
    for n in neighbor_ids:
        rows.append({'neighbor_grid':n, 'month':m})

neighbor = pd.DataFrame(rows).drop_duplicates()
neighbor.to_csv('RF_2020_predicted_1km.csv', index=False, encoding='utf-8-sig')

# ---------- 7. 매트릭스 ----------
months=[6,7,8,9,10]
matrix = pd.DataFrame({'격자100m':truth['격자100m'].unique()})
for m in months:
    matrix[f'{m}월'] = matrix['격자100m'].isin(
        neighbor.loc[neighbor['month']==m,'neighbor_grid']).astype(int)
matrix.to_csv('RF_2020_1km_fullmatrix.csv', index=False, encoding='utf-8-sig')
