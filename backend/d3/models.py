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

'''
class fixbug_data(models.Model):
    grid_100 = models.FloatField(primary_key=True)
    x = models.FloatField(null=True)  # 위도
    y = models.FloatField(null=True)  # 경도
    p_t_g = models.FloatField(null=True) # 평균 토지 공지시가
    p_t_m = models.FloatField(null=True) # 평균 토지 면적
    h_t_m = models.FloatField(null=True) # 합계 토지 면적
    p_td_g = models.FloatField(null=True) # 평균 토지대장 공시지가
    t_tp = models.FloatField(null=True) # 합계 토지필지수
    t_t_z = models.FloatField(null=True) # 합계 토지 지목수
    twenty = models.FloatField(null=True) # 인구 연령 20대
    t_t_z_z = models.FloatField(null=True) # 합계 토지 지목수 전
    fourty = models.FloatField(null=True) # 인구 연령 40대
    p_t_g = models.FloatField(null=True) # 합계 토지 지목수 구거
    p_t_g = models.FloatField(null=True) # 인구 연령 40대
    p_t_g = models.FloatField(null=True) # 인구 연령 40대
    p_t_g = models.FloatField(null=True) # 인구 연령 40대
    p_t_g = models.FloatField(null=True) # 인구 연령 40대
'''    