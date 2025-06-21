import pandas as pd
import matplotlib.pyplot as plt

# 한글 폰트 설정 (Windows 예시: Malgun Gothic)
plt.rcParams['font.family'] = 'Malgun Gothic'
plt.rcParams['axes.unicode_minus'] = False  # 마이너스 기호 깨짐 방지
plt.rcParams['font.size'] = 12              # 기본 글자 크기

# CSV 읽기 (CP949 인코딩)
csv_path = 'Top_15_Features_by_Average_Importance.csv'
df = pd.read_csv(csv_path, encoding='cp949')

# 그래프 그리기
plt.figure(figsize=(10, 9))  # 세로를 조금 더 길게 (12×9)
plt.bar(df['feature'], df['avg_importance'], color='gray')

plt.xticks(rotation=45, ha='right', fontsize=13)            # x축 글자 크기 조절
plt.ylabel('Average Importance', fontsize=15)               # y축 레이블 글자 크기
plt.title('Top 15 Features by Average Importance', fontsize=17)  # 제목 글자 크기

plt.tight_layout()
plt.show()
