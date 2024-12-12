from django.urls import path
from . import views

urlpatterns = [
    path('get_xy/', views.get_xy, name='get_xy'),
]