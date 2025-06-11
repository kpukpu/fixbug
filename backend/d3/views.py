from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json
from .models import fixbug_db

@csrf_exempt
def get_xy(request):
    if request.method == 'POST':
        try:
            # 요청에서 좌표를 가져옴
            data = json.loads(request.body)
            longitude = data.get('longitude')
            latitude = data.get('latitude')

            if longitude is None or latitude is None:
                return JsonResponse({'error': '좌표값이 누락되었습니다.'}, status=400)

            # 로그: 원래 좌표 출력
            print(f"Received coordinates: longitude={longitude}, latitude={latitude}")

            # 좌표 반올림 (소수점 7자리까지만 유지)
            rounded_longitude = round(longitude, 7)
            rounded_latitude = round(latitude, 7)

            # 로그: 반올림된 좌표 출력
            print(f"Rounded coordinates: longitude={rounded_longitude}, latitude={rounded_latitude}")

            # 허용 오차 설정
            tolerance = 0.00001  # 허용 오차 추가

            # 데이터베이스에서 근사값 검색
            results = fixbug_db.objects.filter(
                x__gte=rounded_latitude - tolerance, x__lte=rounded_latitude + tolerance,
                y__gte=rounded_longitude - tolerance, y__lte=rounded_longitude + tolerance
            )

            # 검색된 데이터가 없을 경우
            if not results.exists():
                return JsonResponse({'error': '해당 좌표의 데이터를 찾을 수 없습니다.'}, status=404)

            # 데이터 변환 (JSON 형태로 반환)
            data_list = [
                {
                    'grid_100': result.grid_100,
                    'h_area': result.h_area,
                    'b_area': result.b_area,
                    'g_area': result.g_area,
                    'city': result.city,
                    'h_a_area': result.h_a_area,
                    'x': result.x,
                    'y': result.y,
                    'male': result.male,
                    'female': result.female,
                    'total_population': result.total_population,
                    'kid': result.kid,
                    'old': result.old,
                    'realkid': result.realkid,
                    'element': result.element,
                    'middle': result.middle,
                    'high': result.high,
                    'twenty': result.twenty,
                    'thirty': result.thirty,
                    'fourty': result.fourty,
                    'fifty': result.fifty,
                    'sixty': result.sixty,
                    'seventy': result.seventy,
                    
                }
                for result in results
            ]

            # 로그: 반환할 데이터 개수 출력
            print(f"Found {len(data_list)} results for given coordinates.")

            return JsonResponse({'data': data_list}, status=200)

        except json.JSONDecodeError:
            return JsonResponse({'error': '요청 데이터가 올바른 JSON 형식이 아닙니다.'}, status=400)

        except Exception as e:
            print(f"서버 오류: {str(e)}")  # 예외 로깅
            return JsonResponse({'error': f'서버 오류: {str(e)}'}, status=500)
    # 잘못된 요청 처리 (POST 이외의 요청)
    return JsonResponse({'error': 'POST 요청만 허용됩니다.'}, status=405)




@csrf_exempt
def dong_data(request):
    if request.method == 'POST':
        try:
            # 요청에서 좌표를 가져옴
            data = json.loads(request.body)
            longitude = data.get('longitude')
            latitude = data.get('latitude')

            if longitude is None or latitude is None:
                return JsonResponse({'error': '좌표값이 누락되었습니다.'}, status=400)

            # 로그: 원래 좌표 출력
            print(f"Received coordinates: longitude={longitude}, latitude={latitude}")

            # 좌표 반올림 (소수점 7자리까지만 유지)
            rounded_longitude = round(longitude, 7)
            rounded_latitude = round(latitude, 7)

            # 로그: 반올림된 좌표 출력
            print(f"Rounded coordinates: longitude={rounded_longitude}, latitude={rounded_latitude}")

            # 허용 오차 설정
            tolerance = 0.00001  # 허용 오차 추가

            # 데이터베이스에서 근사값 검색
            results = fixbug_db.objects.filter(
                x__gte=rounded_latitude - tolerance, x__lte=rounded_latitude + tolerance,
                y__gte=rounded_longitude - tolerance, y__lte=rounded_longitude + tolerance
            )

            # 검색된 데이터가 없을 경우
            if not results.exists():
                return JsonResponse({'error': '해당 좌표의 데이터를 찾을 수 없습니다.'}, status=404)

            # 데이터 변환 (JSON 형태로 반환)
            data_list = [
                {
                    'grid_100': result.grid_100,
                    'h_area': result.h_area,
                    'b_area': result.b_area,
                    'g_area': result.g_area,
                }
                for result in results
            ]

            # 로그: 반환할 데이터 개수 출력
            print(f"Found {len(data_list)} results for given coordinates.")

            return JsonResponse({'data': data_list}, status=200)

        except json.JSONDecodeError:
            return JsonResponse({'error': '요청 데이터가 올바른 JSON 형식이 아닙니다.'}, status=400)

        except Exception as e:
            print(f"서버 오류: {str(e)}")  # 예외 로깅
            return JsonResponse({'error': f'서버 오류: {str(e)}'}, status=500)
    # 잘못된 요청 처리 (POST 이외의 요청)
    return JsonResponse({'error': 'POST 요청만 허용됩니다.'}, status=405)