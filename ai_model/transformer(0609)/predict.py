import pandas as pd
import numpy as np
import torch
from sklearn.preprocessing import StandardScaler
from trans import TransformerClassifier  # 기존 trans.py에서 가져오기

def load_models(output_dir, device, input_dim, hidden, drop):
    models = []
    for fold in range(1, 6):
        model = TransformerClassifier(
            input_dim=input_dim,
            hidden=hidden,
            heads=4,
            layers=2,
            dropout=drop
        ).to(device)
        state = torch.load(f'{output_dir}/model_fold{fold}.pth', map_location=device)
        model.load_state_dict(state)
        model.eval()
        models.append(model)
    return models

def main():
    device = torch.device('cpu')

    # 1) SMOTE 데이터 로드 및 스케일러 준비
    smote_df = pd.read_excel('공간예측용_SMOTE.xlsx')
    smote_df.columns = smote_df.columns.str.strip()
    smote_feat_df = smote_df.drop(['격자100m', '민원_발생여부_All'], axis=1).dropna()
    scaler = StandardScaler().fit(smote_feat_df.values.astype(np.float32))

    # 2) 원본 데이터 로드 및 전처리
    orig_df = pd.read_excel('공간예측용.xlsx')
    orig_df.columns = orig_df.columns.str.strip()

    # 격자 ID, 위도/경도, 실제 라벨 추출
    grid_ids    = orig_df['격자100m'].values
    latitudes   = orig_df['위도'].values
    longitudes  = orig_df['경도'].values
    true_labels = orig_df['민원_발생여부_All'].values.astype(int)

    # 예측에 사용할 feature: 라벨, 격자ID 제외
    feat_df = orig_df.drop(['격자100m', '민원_발생여부_All'], axis=1)

    # 결측치 제거 시, 모든 배열 필터링
    mask = ~feat_df.isna().any(axis=1)
    feat_df    = feat_df[mask]
    grid_ids   = grid_ids[mask]
    true_labels= true_labels[mask]
    latitudes  = latitudes[mask]
    longitudes = longitudes[mask]

    # 3) 스케일링 및 모델 불러오기
    X_orig = scaler.transform(feat_df.values.astype(np.float32))
    models = load_models(
        output_dir='output', device=device,
        input_dim=X_orig.shape[1], hidden=128, drop=0.1
    )

    # 4) 앙상블 예측 및 score 계산
    prob_sum = np.zeros(len(X_orig), dtype=np.float32)
    with torch.no_grad():
        for model in models:
            inp = torch.from_numpy(X_orig).to(device)
            prob = torch.sigmoid(model(inp)).cpu().numpy()
            prob_sum += prob
    avg_prob = prob_sum / len(models)
    preds    = (avg_prob >= 0.5).astype(int)

    # 5) 정확도 출력
    accuracy = (preds == true_labels).mean()
    print(f'Original-data Accuracy: {accuracy:.4f}')

    # 6) CSV 저장: 한글 깨짐 방지(UTF-8 BOM), score 및 실제 레이블 추가
    out_df = pd.DataFrame({
        '격자100m': grid_ids,
        '위도': latitudes,
        '경도': longitudes,
        'score': avg_prob,
        'predicted_label': preds,
        'actual_label': true_labels
    })
    out_df.to_csv('grid_predictions.csv', index=False, encoding='utf-8-sig')
    print('Saved predictions to grid_predictions.csv with score, predictions, and actual labels')

if __name__ == '__main__':
    main()
