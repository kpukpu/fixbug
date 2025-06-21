import os
import pandas as pd
import numpy as np
import torch

import lightning.pytorch as pl
from lightning.pytorch import Trainer, seed_everything

from pytorch_forecasting import (
    TimeSeriesDataSet, TemporalFusionTransformer, Baseline
)
from pytorch_forecasting.data import GroupNormalizer
from pytorch_forecasting.metrics import QuantileLoss

if __name__ == "__main__":
    # 1) 데이터 불러오기
    panel = pd.read_csv("panel.csv", encoding="utf-8-sig")
    print("Loaded panel:", panel.shape)

    # 2) 타입 변환
    panel["time_idx"] = panel["time_idx"].astype(int)
    panel["grid_idx"] = panel["grid_idx"].astype(str)

    # 3) 하이퍼파라미터
    max_prediction_length = 12
    max_encoder_length    = 60

    # 4) 학습/검증 시점 분리
    cutoff = panel["time_idx"].max() - max_prediction_length

    # 5) TimeSeriesDataSet 정의
    dataset = TimeSeriesDataSet(
        panel[panel.time_idx <= cutoff],
        time_idx="time_idx",
        target="민원수",
        group_ids=["grid_idx"],
        min_encoder_length=36,
        max_encoder_length=max_encoder_length,
        min_prediction_length=max_prediction_length,
        max_prediction_length=max_prediction_length,
        static_categoricals=["grid_idx"],
        static_reals=[],
        time_varying_known_categoricals=[],
        time_varying_known_reals=["time_idx"],
        time_varying_unknown_categoricals=[],
        time_varying_unknown_reals=[
            "민원수",
            "방역예산",
            "해충퇴치기_설치수",
            "해충퇴치기_누적_설치수",
            "평균기온",
            "최고기온",
            "최저기온",
            "합계강수량",
        ],
        target_normalizer=GroupNormalizer(
            groups=["grid_idx"], transformation="softplus"
        ),
        add_relative_time_idx=True,
        add_target_scales=True,
        add_encoder_length=True,
    )

    # 6) DataLoader 생성
    batch_size   = 64
    train_loader = dataset.to_dataloader(train=True,  batch_size=batch_size, num_workers=4)
    val_dataset  = TimeSeriesDataSet.from_dataset(
        dataset, panel, predict=True, stop_randomization=True
    )
    val_loader   = val_dataset.to_dataloader(train=False, batch_size=batch_size, num_workers=4)

    # 7) Trainer 설정
    seed_everything(42)
    trainer = Trainer(
        max_epochs=30,
        accelerator="cpu",           # CPU 전용
        devices=os.cpu_count(),      # 가능한 모든 CPU 코어 사용
        strategy="ddp",              # CPU에서도 동작하는 DDP(분산) 전략
        gradient_clip_val=0.1,
        limit_train_batches=1.0,
        limit_val_batches=1.0,
    )

    # 8) Temporal Fusion Transformer 모델 생성
    tft = TemporalFusionTransformer.from_dataset(
        dataset,
        learning_rate=3e-3,
        hidden_size=16,
        attention_head_size=1,
        dropout=0.1,
        hidden_continuous_size=8,
        output_size=3,            # QuantileLoss용 출력 채널 수
        loss=QuantileLoss(),
        log_interval=10,
        reduce_on_plateau_patience=4,
    )

    # 9) 학습 시작
    trainer.fit(
        tft,
        train_dataloaders=train_loader,
        val_dataloaders=val_loader,
    )

    # 10) 검증 예측 및 Baseline 비교
    actuals        = torch.cat([y[0] for x, y in val_loader], dim=0)
    predictions    = tft.predict(val_loader)
    baseline_preds = Baseline().predict(val_loader)

    print("----- Baseline vs TFT MAE -----")
    print(f"Baseline MAE: {((baseline_preds - actuals).abs()).mean().item():.4f}")
    print(f"TFT      MAE: {((predictions    - actuals).abs()).mean().item():.4f}")
