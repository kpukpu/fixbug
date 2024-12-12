from django.db import models

# 수강생 정보를 저장하는 모델
class fixbug_db(models.Model):
    grid_100 = models.CharField(max_length=100, primary_key=True)
    h_area = models.CharField(max_length=100)  # 행정동명
    b_area = models.CharField(max_length=255)  # 법정동명
    g_area = models.CharField(max_length=100, null=True)  # 기초구역명
    city = models.CharField(max_length=100)  # 시군구
    h_a_area = models.CharField(max_length=255)  # 행정동 전체 명칭
    x = models.FloatField(null=True)  # 위도
    y = models.FloatField(null=True)  # 경도
    male = models.IntegerField(null=True)  # 남자 인구
    female = models.IntegerField(null=True)  # 여자 인구
    total_population = models.IntegerField(null=True)  # 총 인구 수
    kid = models.IntegerField(null=True)  # 유소년 인구
    old = models.IntegerField(null=True)  # 노인 인구
    realkid = models.IntegerField(null=True)  # 유아 수
    element = models.IntegerField(null=True)  # 초등학생 수
    middle = models.IntegerField(null=True)  # 중학생 수
    high = models.IntegerField(null=True)  # 고등학생 수
    twenty = models.IntegerField(null=True)  # 20대 인구
    thirty = models.IntegerField(null=True)  # 30대 인구
    fourty = models.IntegerField(null=True)  # 40대 인구
    fifty = models.IntegerField(null=True)  # 50대 인구
    sixty = models.IntegerField(null=True)  # 60대 인구
    seventy = models.IntegerField(null=True)  # 70대 인구