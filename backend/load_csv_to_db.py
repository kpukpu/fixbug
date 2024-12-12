import os
import django
import csv
from d3.models import fixbug_db  # 모델을 적절히 변경하세요

# Django 설정 초기화
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')  # 프로젝트 이름으로 변경
django.setup()

# CSV 데이터 삽입
with open('C:/Users/kpukpu/haha123.csv', encoding='utf-8') as csvfile:
    reader = csv.reader(csvfile)  # 헤더가 없는 CSV 파일 읽기
    for row in reader:
        if len(row) > 0:  # 빈 행이 있는 경우 건너뛰기
            fixbug_db.objects.create(
                grid_100=row[0],
                h_area=row[1],
                b_area=row[2],
                g_area=row[3],
                city=row[4],
                h_a_area=row[5],
                x=row[6],
                y=row[7],
                male=row[8],
                female=row[9],
                total_population=row[10],
                kid=row[11],
                old=row[12],
                realkid=row[13],
                element=row[14],
                middle=row[15],
                high=row[16],
                twenty=row[17],
                thirty=row[18],
                fourty=row[19],
                fifty=row[20],
                sixty=row[21],
                seventy=row[22],
            )
