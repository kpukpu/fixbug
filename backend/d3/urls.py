from django.urls import path
from . import views

urlpatterns = [
    path('get_xy/', views.get_xy, name='get_xy'),
    path('dong_data/', views.dong_data, name='dong_data'),
]