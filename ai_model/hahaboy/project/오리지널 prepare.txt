import pandas as pd
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
from math import ceil, sqrt
import sys

# 1) Load static & dynamic Excel
static_df = pd.read_excel('data1.xlsx')  # 정적 피처
dyn_df    = pd.read_excel('data2.xlsx')  # wide-format 동적 피처

# 2) Identifier cols check
id_cols = ['격자100m','위도','경도']
for df_, name in ((static_df,'data1.xlsx'), (dyn_df,'data2.xlsx')):
    for c in id_cols:
        if c not in df_.columns:
            raise KeyError(f"Identifier column '{c}' not found in {name}")

# 3) Static feature list (123개)
static_cols = [
    '인구_남','인구_여','인구_총인구','인구_유소년','인구_생산가능','인구_고령','인구_유아',
    '인구_초등학생','인구_중학생','인구_고등학생','인구_연령_20대','인구_연령_30대',
    '인구_연령_40대','인구_연령_50대','인구_연령_60대','인구_연령_70대','인구_연령_80대',
    '인구_연령_90대','인구_연령_100세이상','평균_건물_일반_건축면적','평균_건물_일반_건폐율',
    '평균_건물_일반_높이','평균_건물_일반_대지면적','평균_건물_일반_연면적','평균_건물_일반_용적율',
    '평균_건물_일반_지상층수','평균_건물_일반_지하층수','합계_건물_건축물수_계','최대_건축물_사용승인일',
    '합계_건물_건축물수_시기별_9년이하','합계_건물_건축물수_시기별_10년이상_14년이하',
    '합계_건물_건축물수_시기별_15년이상_19년이하','합계_건물_건축물수_시기별_20년이상_24년이하',
    '합계_건물_건축물수_시기별_25년이상_29년이하','합계_건물_건축물수_시기별_30년이상_34년이하',
    '합계_건물_건축물수_시기별_35년이상','합계_건물_주용도_건축물수_공동','합계_건물_주용도_건축물수_단독',
    '최대_건물_주용도_주용도코드','합계_건물_구조_건축물수_일반목구조','합계_건물_구조_건축물수_철근콘크리트구조',
    '최대_건물_구조_구조코드','평균_건물_개별주택_개별주택가격','평균_건물_개별주택_주거용도면적',
    '평균_토지_공시지가','단지수','합계_세대수_아파트','합계_세대수_연립주택','합계_세대수_주상복합',
    '합계_세대수_도시형_아파트','합계_세대수_도시형_연립','합계_세대수_도시형_주상복합','합계_동수',
    '합계_세대수','합계_일반관리-인원','합계_경비관리-인원','합계_청소관리-인원','합계_연간소독횟수',
    '합계_전기-수전용량','합계_총주차대수','합계_지상주차대수','합계_지하주차대수','합계_CCTV대수',
    '합계_연면적','합계_건축물대장연면적','합계_관리비부과면적','합계_주거전용면적',
    '합계_세대수_전용면적_40이하','합계_세대수_전용면적_40초과60이하','합계_세대수_전용면적_60초과85이하',
    '합계_세대수_전용면적_85초과105이하','합계_세대수_전용면적_105초과125이하','합계_세대수_전용면적_125초과',
    '평균_공동주택_건물연령','합계_공동주택_건축물수_시기별_4년이하','합계_공동주택_건축물수_시기별_5년이상_9년이하',
    '합계_공동주택_건축물수_시기별_10년이상_14년이하','합계_공동주택_건축물수_시기별_15년이상_19년이하',
    '합계_공동주택_건축물수_시기별_20년이상_24년이하','합계_공동주택_건축물수_시기별_25년이상_29년이하',
    '합계_공동주택_건축물수_시기별_30년이상_34년이하','합계_공동주택_건축물수_시기별_35년이상',
    '평균_공동주택_전용면적','소상공인_관광여가오락_계','소상공인_부동산_계','소상공인_생활서비스_계',
    '소상공인_소매_계','소상공인_숙박_계','소상공인_스포츠_계','소상공인_음식_계','소상공인_학문교육_계',
    '소상공인_계_업종','합계_토지필지수','합계_토지_면적','평균_토지_면적','평균_토지대장_공시지가',
    '합계_토지_지목수_공원','합계_토지_지목수_공장용지','합계_토지_지목수_과수원','합계_토지_지목수_구거',
    '합계_토지_지목수_답','합계_토지_지목수_대','합계_토지_지목수_도로','합계_토지_지목수_목장용지',
    '합계_토지_지목수_묘지','합계_토지_지목수_사적지','합계_토지_지목수_수도용지','합계_토지_지목수_양어장',
    '합계_토지_지목수_유원지','합계_토지_지목수_유지','합계_토지_지목수_임야','합계_토지_지목수_잡종지',
    '합계_토지_지목수_전','합계_토지_지목수_제방','합계_토지_지목수_종교용지','합계_토지_지목수_주유소용지',
    '합계_토지_지목수_주차장','합계_토지_지목수_창고용지','합계_토지_지목수_철도용지','합계_토지_지목수_체육용지',
    '합계_토지_지목수_하천','합계_토지_지목수_학교용지','합계_토지_지목수_계'
]

# 4) Dynamic prefixes
dynamic_prefixes = [
    '민원수_','방역예산_',
    '해충퇴치기_설치수_','해충퇴치기_누적_설치수_',
    '평균기온_','최고기온_','최저기온_','합계강수량_'
]
dyn_names = [p.rstrip('_') for p in dynamic_prefixes]

# 5) Melt dynamic wide→long
panel_dyn = None
for pref in dynamic_prefixes:
    cols = [c for c in dyn_df.columns if c.startswith(pref)]
    tmp = dyn_df[id_cols + cols].melt(
        id_vars=id_cols, value_vars=cols,
        var_name='orig', value_name=pref.rstrip('_')
    )
    tmp['year_month'] = (
        tmp['orig']
           .str.replace(pref, '', regex=False)
           .str.replace(r'(\d{2})_(\d{2})',
                        lambda m: f"20{m.group(1)}-{m.group(2)}",
                        regex=True)
    )
    tmp = tmp.drop(columns='orig')
    panel_dyn = tmp if panel_dyn is None else panel_dyn.merge(
        tmp, on=id_cols+['year_month'], how='outer'
    )

# 6) Grid metadata
grid_meta = static_df[id_cols].drop_duplicates().reset_index(drop=True)
grid_meta['grid_idx'] = np.arange(len(grid_meta))
grid_meta = grid_meta.merge(
    static_df[id_cols+static_cols].drop_duplicates(),
    on=id_cols, how='left'
)

# 7) H, W grid dimensions
N = len(grid_meta)
W = H = ceil(sqrt(N))

# 8) Full space–time skeleton
all_months = sorted(panel_dyn['year_month'].unique())
full_idx = pd.MultiIndex.from_product(
    [all_months, np.arange(H*W)],
    names=['year_month','grid_idx']
)
full_df = pd.DataFrame(index=full_idx).reset_index()

# 9) Merge static + dynamic
full_df = full_df.merge(
    grid_meta.assign(**{c:0 for c in static_cols}),
    on='grid_idx', how='left'
)
panel_dyn = panel_dyn.merge(
    grid_meta[id_cols+['grid_idx']], on=id_cols, how='left'
)
full_df = full_df.merge(
    panel_dyn[['year_month','grid_idx']+dyn_names],
    on=['year_month','grid_idx'], how='left'
)
full_df[static_cols] = full_df[static_cols].fillna(0)
full_df[dyn_names]    = full_df[dyn_names].fillna(0)

# 10) Compute row/col & sort
full_df['row'] = full_df['grid_idx'] // W
full_df['col'] = full_df['grid_idx'] % W
full_df = full_df.sort_values(['year_month','row','col']).reset_index(drop=True)

# 11) Build data tensor (T,H,W,C)
T = len(all_months)
feature_cols = static_cols + dyn_names
vals = full_df[feature_cols].to_numpy(np.float32)
data = vals.reshape(T, H, W, len(feature_cols))

# 12) Sliding window for inputs (민원수 제외)
K = 12
# 인덱스 계산
static_len = len(static_cols)
mn_idx     = static_len + dyn_names.index('민원수')
input_idxs = list(range(static_len)) + [static_len + i for i in range(len(dyn_names)) if dyn_names[i]!='민원수']

# 윈도우
X = sliding_window_view(data[..., input_idxs], window_shape=K, axis=0)
X = np.moveaxis(X, -1, 1)  # → (T-K+1, K, H, W, C-1)
X = X[:-1]                 # → (T-K, K, H, W, C-1)

# 13) Targets: 민원수 채널만
Y_full = data[..., mn_idx]           # (T, H, W)
Y      = Y_full[K:][..., np.newaxis] # (T-K, H, W, 1)

# 14) Save
np.savez_compressed('convLSTM_data.npz', X=X, Y=Y)
full_df[['grid_idx','격자100m','위도','경도']].drop_duplicates().to_csv(
    'grid_meta.csv', index=False, encoding='utf-8-sig'
)

print("✅ prepare_convLSTM complete")
print(f"H={H}, W={W}, static_feats={len(static_cols)}, dyn_feats={len(dyn_names)-1}")
print(f"X.shape = {X.shape}")   # (66,12,98,98,static+dyn-1)
print(f"Y.shape = {Y.shape}")   # (66,98,98,1)
