import pandas as pd
import numpy as np
from math import ceil, sqrt
import sys

# 1) static + dynamic 파일 읽기
static_df = pd.read_excel('data1.xlsx')
dyn_df    = pd.read_excel('data2.xlsx')

# 2) 식별자 컬럼 확인
id_cols = ['격자100m','위도','경도']
for df_ in (static_df, dyn_df):
    for c in id_cols:
        if c not in df_.columns:
            raise KeyError(f"Identifier column '{c}' not found in {'data1.xlsx' if df_ is static_df else 'data2.xlsx'}")

# 3) 정적 피처 리스트 (data1.xlsx 에 있는 모든 정적 컬럼)
static_cols = [
    '인구_남','인구_여','인구_총인구','인구_유소년','인구_생산가능','인구_고령','인구_유아',
    '인구_초등학생','인구_중학생','인구_고등학생','인구_연령_20대','인구_연령_30대','인구_연령_40대',
    '인구_연령_50대','인구_연령_60대','인구_연령_70대','인구_연령_80대','인구_연령_90대','인구_연령_100세이상',
    '평균_건물_일반_건축면적','평균_건물_일반_건폐율','평균_건물_일반_높이','평균_건물_일반_대지면적',
    '평균_건물_일반_연면적','평균_건물_일반_용적율','평균_건물_일반_지상층수','평균_건물_일반_지하층수',
    '합계_건물_건축물수_계','최대_건축물_사용승인일','합계_건물_건축물수_시기별_9년이하',
    '합계_건물_건축물수_시기별_10년이상_14년이하','합계_건물_건축물수_시기별_15년이상_19년이하',
    '합계_건물_건축물수_시기별_20년이상_24년이하','합계_건물_건축물수_시기별_25년이상_29년이하',
    '합계_건물_건축물수_시기별_30년이상_34년이하','합계_건물_건축물수_시기별_35년이상',
    '합계_건물_주용도_건축물수_공동','합계_건물_주용도_건축물수_단독','최대_건물_주용도_주용도코드',
    '합계_건물_구조_건축물수_일반목구조','합계_건물_구조_건축물수_철근콘크리트구조','최대_건물_구조_구조코드',
    '평균_건물_개별주택_개별주택가격','평균_건물_개별주택_주거용도면적','평균_토지_공시지가','단지수',
    '합계_세대수_아파트','합계_세대수_연립주택','합계_세대수_주상복합','합계_세대수_도시형_아파트',
    '합계_세대수_도시형_연립','합계_세대수_도시형_주상복합','합계_동수','합계_세대수','합계_일반관리-인원',
    '합계_경비관리-인원','합계_청소관리-인원','합계_연간소독횟수','합계_전기-수전용량','합계_총주차대수',
    '합계_지상주차대수','합계_지하주차대수','합계_CCTV대수','합계_연면적','합계_건축물대장연면적',
    '합계_관리비부과면적','합계_주거전용면적','합계_세대수_전용면적_40이하','합계_세대수_전용면적_40초과60이하',
    '합계_세대수_전용면적_60초과85이하','합계_세대수_전용면적_85초과105이하','합계_세대수_전용면적_105초과125이하',
    '합계_세대수_전용면적_125초과','평균_공동주택_건물연령','합계_공동주택_건축물수_시기별_4년이하',
    '합계_공동주택_건축물수_시기별_5년이상_9년이하','합계_공동주택_건축물수_시기별_10년이상_14년이하',
    '합계_공동주택_건축물수_시기별_15년이상_19년이하','합계_공동주택_건축물수_시기별_20년이상_24년이하',
    '합계_공동주택_건축물수_시기별_25년이상_29년이하','합계_공동주택_건축물수_시기별_30년이상_34년이하',
    '합계_공동주택_건축물수_시기별_35년이상','평균_공동주택_전용면적',
    '소상공인_관광여가오락_계','소상공인_부동산_계','소상공인_생활서비스_계','소상공인_소매_계',
    '소상공인_숙박_계','소상공인_스포츠_계','소상공인_음식_계','소상공인_학문교육_계','소상공인_계_업종',
    '합계_토지필지수','합계_토지_면적','평균_토지_면적','평균_토지대장_공시지가','합계_토지_지목수_공원',
    '합계_토지_지목수_공장용지','합계_토지_지목수_과수원','합계_토지_지목수_구거','합계_토지_지목수_답',
    '합계_토지_지목수_대','합계_토지_지목수_도로','합계_토지_지목수_목장용지','합계_토지_지목수_묘지',
    '합계_토지_지목수_사적지','합계_토지_지목수_수도용지','합계_토지_지목수_양어장','합계_토지_지목수_유원지',
    '합계_토지_지목수_유지','합계_토지_지목수_임야','합계_토지_지목수_잡종지','합계_토지_지목수_전',
    '합계_토지_지목수_제방','합계_토지_지목수_종교용지','합계_토지_지목수_주유소용지','합계_토지_지목수_주차장',
    '합계_토지_지목수_창고용지','합계_토지_지목수_철도용지','합계_토지_지목수_체육용지','합계_토지_지목수_하천',
    '합계_토지_지목수_학교용지','합계_토지_지목수_계'
]

# 4) 동적 prefix 목록
dynamic_prefixes = [
    '민원수_', '방역예산_',
    '해충퇴치기_설치수_', '해충퇴치기_누적_설치수_',
    '평균기온_', '최고기온_', '최저기온_', '합계강수량_'
]
dyn_names = [p.rstrip('_') for p in dynamic_prefixes]

# 5) dyn_df를 long-format으로 melt
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

# 6) 정적 메타 생성
grid_meta = static_df[id_cols].drop_duplicates().reset_index(drop=True)
grid_meta['grid_idx'] = np.arange(len(grid_meta))
grid_meta = grid_meta.merge(
    static_df[id_cols+static_cols].drop_duplicates(),
    on=id_cols, how='left'
)

# 7) 격자 H×W 자동 계산
N = len(grid_meta)
W = H = ceil(sqrt(N))

# 8) 전체 시공간 skeleton
all_months = sorted(panel_dyn['year_month'].unique())
full_idx   = pd.MultiIndex.from_product(
    [all_months, np.arange(H*W)],
    names=['year_month','grid_idx']
)
full_df = pd.DataFrame(index=full_idx).reset_index()

# 9) static 합치기
full_df = full_df.merge(grid_meta, on='grid_idx', how='left')
full_df[static_cols] = full_df[static_cols].fillna(0)

# 10) dynamic 합치기
panel_dyn = panel_dyn.merge(
    grid_meta[id_cols+['grid_idx']], on=id_cols, how='left'
)
full_df = full_df.merge(
    panel_dyn[['year_month','grid_idx']+dyn_names],
    on=['year_month','grid_idx'], how='left'
)
full_df[dyn_names] = full_df[dyn_names].fillna(0)

# 11) row/col
full_df['row'] = full_df['grid_idx'] // W
full_df['col'] = full_df['grid_idx'] % W

# 12) time_idx (문자열 카테고리)
full_df = full_df.sort_values(['year_month','grid_idx']).reset_index(drop=True)
full_df['time_idx'] = pd.factorize(full_df['year_month'])[0].astype(str)

# 13) CSV로 저장
full_df.to_csv('panel.csv', index=False, encoding='utf-8-sig')
grid_meta[['grid_idx','격자100m','위도','경도']].to_csv(
    'grid_meta.csv', index=False, encoding='utf-8-sig'
)

print("✅ prepare_tft complete")
print(f"panel.csv  shape = {full_df.shape}")
print(f"grid_meta.csv shape = {grid_meta.shape}")
