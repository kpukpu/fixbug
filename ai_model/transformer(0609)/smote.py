import pandas as pd
from imblearn.over_sampling import SMOTE

# 데이터 불러오기
df = pd.read_excel("공간예측용.xlsx")

# X, y 분리
X = df.drop(columns=["민원_발생여부_All"])
y = df["민원_발생여부_All"]

# SMOTE 오버샘플링
smote = SMOTE(random_state=42)
X_res, y_res = smote.fit_resample(X, y)

# 오버샘플링된 데이터 결합
df_resampled = pd.concat([X_res, y_res], axis=1)

# 파일 저장
df_resampled.to_excel("공간예측용_SMOTE.xlsx", index=False)
