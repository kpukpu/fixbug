# filename: predict_original.py
import pandas as pd
import numpy as np
import torch
from sklearn.preprocessing import StandardScaler
from trans import TransformerClassifier, ExcelDataset  # 기존 trans.py에서 가져오기

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
    # 1) SMOTE 데이터로 fit한 scaler 준비
    smote_ds = ExcelDataset('공간예측용_SMOTE.xlsx')
    scaler = StandardScaler().fit(smote_ds.features)

    # 2) 원본 데이터 로드 및 전처리
    orig_df = pd.read_excel('공간예측용.xlsx')
    orig_df.columns = orig_df.columns.str.strip()
    grid_ids = orig_df['격자100m'].values
    true_labels = orig_df['민원_발생여부_All'].values.astype(int)
    feat_df = orig_df.drop(['격자100m', '민원_발생여부_All'], axis=1)
    # 결측치 제거 시, grid_ids/true_labels도 같이 맞춰야 함
    mask = ~feat_df.isna().any(axis=1)
    feat_df = feat_df[mask]
    grid_ids = grid_ids[mask]
    true_labels = true_labels[mask]
    X_orig = scaler.transform(feat_df.values.astype(np.float32))

    # 3) 모델 불러와 예측
    #    h, d, o 값은 학습 때 사용한 --hidden, --drop, --output 인자와 동일하게 설정하세요
    models = load_models(output_dir='output',
                         device=device,
                         input_dim=X_orig.shape[1],
                         hidden=128,
                         drop=0.1)

    # 4) 앙상블 예측 (로짓 평균)
    logits_sum = np.zeros(len(X_orig), dtype=np.float32)
    with torch.no_grad():
        for model in models:
            inp = torch.from_numpy(X_orig).to(device)
            logits = model(inp).cpu().numpy()  # raw logits
            prob = 1 / (1 + np.exp(-logits))   # sigmoid
            logits_sum += prob

    avg_prob = logits_sum / len(models)
    preds = (avg_prob >= 0.5).astype(int)

    # 5) 정확도 계산
    accuracy = (preds == true_labels).mean()
    print(f'Original-data Accuracy: {accuracy:.4f}')

    # 6) CSV 저장
    out_df = pd.DataFrame({
        '격자100m': grid_ids,
        'predicted_label': preds
    })
    out_df.to_csv('grid_predictions.csv', index=False)
    print('Saved predictions to grid_predictions.csv')

if __name__ == '__main__':
    main()
