from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import tensorflow as tf

from .classes import CLASS_NAMES
from .config import TrainingConfig, configure_logging
from .dataset_loader import load_datasets
from .model_loader import load_trained_model

logger = logging.getLogger(__name__)


def _predict_labels(model: tf.keras.Model, dataset: tf.data.Dataset) -> tuple[np.ndarray, np.ndarray]:
    y_true_batches: list[np.ndarray] = []
    y_pred_batches: list[np.ndarray] = []

    for images, labels in dataset:
        predictions = model.predict(images, verbose=0)
        y_true_batches.append(np.argmax(labels.numpy(), axis=1))
        y_pred_batches.append(np.argmax(predictions, axis=1))

    return np.concatenate(y_true_batches), np.concatenate(y_pred_batches)


def _save_confusion_matrix(matrix: np.ndarray, output_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(8, 7))
    im = ax.imshow(matrix, interpolation='nearest', cmap='Blues')
    ax.figure.colorbar(im, ax=ax)
    ax.set(
        xticks=np.arange(len(CLASS_NAMES)),
        yticks=np.arange(len(CLASS_NAMES)),
        xticklabels=CLASS_NAMES,
        yticklabels=CLASS_NAMES,
        ylabel='True label',
        xlabel='Predicted label',
        title='Dementia Classification Confusion Matrix',
    )
    plt.setp(ax.get_xticklabels(), rotation=35, ha='right', rotation_mode='anchor')

    threshold = matrix.max() / 2 if matrix.size else 0
    for row in range(matrix.shape[0]):
        for col in range(matrix.shape[1]):
            ax.text(
                col,
                row,
                format(matrix[row, col], 'd'),
                ha='center',
                va='center',
                color='white' if matrix[row, col] > threshold else 'black',
            )

    fig.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=160, bbox_inches='tight')
    plt.close(fig)


def evaluate_model(model: tf.keras.Model, test_ds: tf.data.Dataset, config: TrainingConfig) -> dict[str, Any]:
    logger.info('Starting model evaluation on test dataset.')
    test_loss, test_accuracy, test_precision, test_recall, test_f1 = model.evaluate(test_ds, verbose=1)
    y_true, y_pred = _predict_labels(model, test_ds)

    report = classification_report(
        y_true,
        y_pred,
        labels=list(range(len(CLASS_NAMES))),
        target_names=list(CLASS_NAMES),
        output_dict=True,
        zero_division=0,
    )
    matrix = confusion_matrix(y_true, y_pred, labels=list(range(len(CLASS_NAMES))))
    overall_accuracy = float(accuracy_score(y_true, y_pred))

    metrics: dict[str, Any] = {
        'test_loss': float(test_loss),
        'test_accuracy': float(test_accuracy),
        'test_precision': float(test_precision),
        'test_recall': float(test_recall),
        'test_f1_score': float(test_f1),
        'overall_accuracy': overall_accuracy,
        'per_class': {
            class_name: {
                'precision': float(report[class_name]['precision']),
                'recall': float(report[class_name]['recall']),
                'f1_score': float(report[class_name]['f1-score']),
                'support': int(report[class_name]['support']),
            }
            for class_name in CLASS_NAMES
        },
        'confusion_matrix': matrix.tolist(),
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }

    config.output_dir.mkdir(parents=True, exist_ok=True)
    config.evaluation_metrics_path.write_text(json.dumps(metrics, indent=2), encoding='utf-8')
    config.classification_report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    _save_confusion_matrix(matrix, config.confusion_matrix_path)

    logger.info('Saved evaluation metrics to %s.', config.evaluation_metrics_path)
    logger.info('Saved classification report to %s.', config.classification_report_path)
    logger.info('Saved confusion matrix to %s.', config.confusion_matrix_path)
    return metrics


def main() -> None:
    configure_logging()
    parser = argparse.ArgumentParser(description='Evaluate the trained dementia classification model.')
    parser.add_argument('--dataset-dir', default=None, help='Path to dataset directory containing train/validation/test.')
    parser.add_argument('--model-dir', default=None, help='Directory containing dementia_model.keras.')
    args = parser.parse_args()

    default_config = TrainingConfig()
    config = TrainingConfig(
        dataset_dir=Path(args.dataset_dir) if args.dataset_dir else default_config.dataset_dir,
        output_dir=Path(args.model_dir) if args.model_dir else default_config.output_dir,
    )
    _, _, test_ds, _ = load_datasets(config)
    model = load_trained_model(config.model_path)
    evaluate_model(model, test_ds, config)


if __name__ == '__main__':
    main()
