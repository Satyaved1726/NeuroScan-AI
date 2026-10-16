from __future__ import annotations

import argparse
from datetime import datetime
import json
import logging
from pathlib import Path
from typing import Any

import tensorflow as tf

from .classes import CLASS_NAMES, class_mapping
from .config import TrainingConfig, configure_logging, detect_compute_device, set_reproducible_seeds
from .dataset_loader import calculate_class_weights, generate_class_distribution_report, load_datasets
from .evaluate import evaluate_model
from .model_loader import build_model

logger = logging.getLogger(__name__)


class EpochMetricsLogger(tf.keras.callbacks.Callback):
    def on_epoch_end(self, epoch: int, logs: dict[str, Any] | None = None) -> None:
        logs = logs or {}
        logger.info(
            'Epoch %s metrics: loss=%.5f accuracy=%.5f precision=%.5f recall=%.5f f1=%.5f '
            'val_loss=%.5f val_accuracy=%.5f',
            epoch + 1,
            logs.get('loss', 0.0),
            logs.get('accuracy', 0.0),
            logs.get('precision', 0.0),
            logs.get('recall', 0.0),
            logs.get('f1_score', 0.0),
            logs.get('val_loss', 0.0),
            logs.get('val_accuracy', 0.0),
        )


def _build_callbacks(config: TrainingConfig) -> list[tf.keras.callbacks.Callback]:
    config.output_dir.mkdir(parents=True, exist_ok=True)
    return [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=8,
            restore_best_weights=True,
            verbose=1,
        ),
        tf.keras.callbacks.ModelCheckpoint(
            filepath=config.model_path,
            monitor='val_loss',
            save_best_only=True,
            save_weights_only=False,
            verbose=1,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.2,
            patience=4,
            min_lr=1e-7,
            verbose=1,
        ),
        tf.keras.callbacks.TensorBoard(
            log_dir=str(config.tensorboard_log_dir / datetime.now().strftime('%Y%m%d-%H%M%S')),
            histogram_freq=1,
        ),
        EpochMetricsLogger(),
    ]


def _save_class_mapping(config: TrainingConfig) -> None:
    config.output_dir.mkdir(parents=True, exist_ok=True)
    config.class_mapping_path.write_text(json.dumps(list(CLASS_NAMES), indent=2), encoding='utf-8')
    if not config.class_mapping_path.exists():
        raise RuntimeError(f'Class mapping save failed: {config.class_mapping_path}')
    logger.info('Saved class mapping to %s.', config.class_mapping_path)


def _save_training_history(history: tf.keras.callbacks.History, config: TrainingConfig) -> None:
    history_payload = {
        'train_accuracy': [float(value) for value in history.history.get('accuracy', [])],
        'val_accuracy': [float(value) for value in history.history.get('val_accuracy', [])],
        'train_loss': [float(value) for value in history.history.get('loss', [])],
        'val_loss': [float(value) for value in history.history.get('val_loss', [])],
        'train_precision': [float(value) for value in history.history.get('precision', [])],
        'val_precision': [float(value) for value in history.history.get('val_precision', [])],
        'train_recall': [float(value) for value in history.history.get('recall', [])],
        'val_recall': [float(value) for value in history.history.get('val_recall', [])],
        'train_f1_score': [float(value) for value in history.history.get('f1_score', [])],
        'val_f1_score': [float(value) for value in history.history.get('val_f1_score', [])],
    }
    config.training_history_path.write_text(json.dumps(history_payload, indent=2), encoding='utf-8')
    logger.info('Saved training history to %s.', config.training_history_path)


def train(config: TrainingConfig) -> dict[str, Any]:
    configure_logging()
    set_reproducible_seeds(config.random_seed)
    logger.info('Detected compute device: %s.', detect_compute_device())
    logger.info('Starting Phase 4B production dementia classification training.')

    train_ds, validation_ds, test_ds, validation_report = load_datasets(config)
    generate_class_distribution_report(config, validation_report)
    class_weights = calculate_class_weights(config)
    _save_class_mapping(config)

    logger.info('Building EfficientNetB0 transfer learning model.')
    model = build_model(config)
    model.summary(print_fn=logger.info)

    logger.info('Training start: epochs=%s batch_size=%s learning_rate=%s.', config.epochs, config.batch_size, config.learning_rate)
    history = model.fit(
        train_ds,
        validation_data=validation_ds,
        epochs=config.epochs,
        class_weight=class_weights,
        callbacks=_build_callbacks(config),
        verbose=1,
    )
    _save_training_history(history, config)

    if not config.model_path.exists():
        logger.info('ModelCheckpoint did not create a file; saving current best weights to %s.', config.model_path)
        model.save(config.model_path)
    if not config.model_path.exists():
        raise RuntimeError(f'Model save failed: {config.model_path}')
    logger.info('Best model saved to %s.', config.model_path)

    evaluation_metrics = evaluate_model(model, test_ds, config)
    logger.info('Training pipeline completed successfully.')
    return evaluation_metrics


def main() -> None:
    parser = argparse.ArgumentParser(description='Train the OASIS dementia classification model with EfficientNetB0.')
    parser.add_argument('--dataset-dir', default=None, help='Path to dataset directory containing train/validation/test.')
    parser.add_argument('--model-dir', default=None, help='Directory where model artifacts will be saved.')
    parser.add_argument('--epochs', type=int, default=TrainingConfig.epochs, help='Number of training epochs.')
    parser.add_argument('--batch-size', type=int, default=TrainingConfig.batch_size, help='Training batch size.')
    parser.add_argument('--learning-rate', type=float, default=TrainingConfig.learning_rate, help='Adam learning rate.')
    args = parser.parse_args()

    default_config = TrainingConfig()
    config = TrainingConfig(
        dataset_dir=Path(args.dataset_dir) if args.dataset_dir else default_config.dataset_dir,
        output_dir=Path(args.model_dir) if args.model_dir else default_config.output_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
    )
    train(config)


if __name__ == '__main__':
    main()
