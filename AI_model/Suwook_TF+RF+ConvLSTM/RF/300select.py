import pandas as pd

df400 = pd.read_csv('400.csv',
                    encoding='cp949',
                    dtype={'격자100m': str})

PRED_COL      = 'predicted_label'         # 예측값 컬럼명 (0/1)
ACTUAL_COL    = 'answer'       # 실제 정답값 컬럼명 (0/1)
PROB_COL      = 'predicted_label'  # 예측 확률 컬럼명 (0~1)
GRID_ID_COL   = '격자100m'      # 격자 ID 컬럼명

sel_pos = df400[(df400[PRED_COL] == 1) | (df400[ACTUAL_COL] == 1)].copy()
print(f"예측=1 또는 실제=1인 샘플 개수: {len(sel_pos)}")  # 181이어야 함

#나머지 중 확률이 0에 가까운 순서로 119개 추출
remaining = df400[~df400[GRID_ID_COL].isin(sel_pos[GRID_ID_COL])]
sel_lowprob = remaining.nsmallest(300 - len(sel_pos), PROB_COL)
print(f"확률 낮은 샘플 추가 개수: {len(sel_lowprob)}")  # 119이어야 함

#최종 300개 ID 리스트
final_ids = pd.concat([sel_pos, sel_lowprob])[GRID_ID_COL].astype(str).tolist()

#'공간.xlsx' 로드
space = pd.read_excel('공간.xlsx', dtype={'격자100m': str})

space['numeric_id'] = space['격자100m'].str.extract(r'(\d+)', expand=False)

#numeric_id가 final_ids에 포함된 행만 필터링
space_filtered = space[space['numeric_id'].isin(final_ids)].copy()
print(f"필터링 후 공간 데이터 개수: {len(space_filtered)}")  # 300

#필요 없는 보조 컬럼 제거
space_filtered.drop(columns=['numeric_id'], inplace=True)

#결과 저장
space_filtered.to_excel('공간_300.xlsx', index=False)
print("=> '공간_300.xlsx'로 저장 완료")
