from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import tensorflow as tf
from PIL import Image, UnidentifiedImageError
from sklearn.utils.class_weight import compute_class_weight

from .classes import CLASS_NAMES, class_mapping
from .config import TrainingConfig
from .preprocess import configure_for_performance, resize_and_prepare

logger = logging.getLogger(__name__)

SPLIT_NAMES = ('train', 'validation', 'test')
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff'}


class DatasetValidationError(RuntimeError):
    pass


def _is_image_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS


def _find_image_files(class_dir: Path) -> list[Path]:
    return sorted(path for path in class_dir.rglob('*') if _is_image_file(path))


def _validate_image_readable(path: Path) -> None:
    try:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            image.convert('RGB').load()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise DatasetValidationError(f'Unreadable image: {path} ({exc})') from exc


def validate_split_dataset(dataset_dir: Path | str) -> dict[str, Any]:
    root = Path(dataset_dir)
    if not root.exists():
        raise DatasetValidationError(f'Dataset directory does not exist: {root}')
    if not root.is_dir():
        raise DatasetValidationError(f'Dataset path is not a directory: {root}')

    report: dict[str, Any] = {
        'dataset': 'OASIS Dementia MRI Dataset',
        'dataset_dir': str(root),
        'expected_splits': list(SPLIT_NAMES),
        'expected_classes': list(CLASS_NAMES),
        'splits': {},
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }

    total_images = 0
    for split in SPLIT_NAMES:
        split_dir = root / split
        if not split_dir.is_dir():
            raise DatasetValidationError(f'Missing dataset split directory: {split_dir}')

        present_classes = {path.name for path in split_dir.iterdir() if path.is_dir()}
        missing_classes = sorted(set(CLASS_NAMES) - present_classes)
        if missing_classes:
            raise DatasetValidationError(f'Missing classes in {split_dir}: {missing_classes}')

        unexpected_classes = sorted(present_classes - set(CLASS_NAMES))
        if unexpected_classes:
            logger.warning('Unexpected class folders in %s: %s', split_dir, unexpected_classes)

        split_report: dict[str, Any] = {'total_images': 0, 'classes': {}}
        for class_name in CLASS_NAMES:
            class_dir = split_dir / class_name
            image_paths = _find_image_files(class_dir)
            if not image_paths:
                raise DatasetValidationError(f'No readable image files found in class directory: {class_dir}')
            for image_path in image_paths:
                _validate_image_readable(image_path)

            image_count = len(image_paths)
            split_report['classes'][class_name] = {
                'class_dir': str(class_dir),
                'image_count': image_count,
            }
            split_report['total_images'] += image_count
            total_images += image_count

        report['splits'][split] = split_report

    report['total_images'] = total_images
    logger.info('Dataset validation passed for %s with %s images.', root, total_images)
    return report


def _load_split(split_dir: Path, config: TrainingConfig, shuffle: bool) -> tf.data.Dataset:
    dataset = tf.keras.utils.image_dataset_from_directory(
        split_dir,
        labels='inferred',
        label_mode='categorical',
        class_names=list(CLASS_NAMES),
        color_mode='rgb',
        batch_size=config.batch_size,
        image_size=config.image_size,
        shuffle=shuffle,
        seed=config.random_seed,
    )
    dataset = dataset.map(lambda image, label: resize_and_prepare(image, label, config), num_parallel_calls=tf.data.AUTOTUNE)
    return configure_for_performance(dataset, shuffle=False, seed=config.random_seed)


def load_datasets(config: TrainingConfig) -> tuple[tf.data.Dataset, tf.data.Dataset, tf.data.Dataset, dict[str, Any]]:
    validation_report = validate_split_dataset(config.dataset_dir)
    logger.info('Loading TensorFlow datasets from %s.', config.dataset_dir)
    train_ds = _load_split(config.dataset_dir / 'train', config, shuffle=True)
    validation_ds = _load_split(config.dataset_dir / 'validation', config, shuffle=False)
    test_ds = _load_split(config.dataset_dir / 'test', config, shuffle=False)
    return train_ds, validation_ds, test_ds, validation_report


def collect_labels(split_dir: Path) -> list[int]:
    labels: list[int] = []
    mapping = class_mapping()
    for class_name in CLASS_NAMES:
        labels.extend([mapping[class_name]] * len(_find_image_files(split_dir / class_name)))
    return labels


def calculate_class_weights(config: TrainingConfig) -> dict[int, float]:
    labels = np.array(collect_labels(config.dataset_dir / 'train'))
    if labels.size == 0:
        raise DatasetValidationError('Cannot calculate class weights because the training split has no images.')

    weights = compute_class_weight(class_weight='balanced', classes=np.arange(len(CLASS_NAMES)), y=labels)
    class_weights = {index: float(weight) for index, weight in enumerate(weights)}
    logger.info('Calculated class weights: %s', class_weights)
    return class_weights


def generate_class_distribution_report(config: TrainingConfig, validation_report: dict[str, Any]) -> dict[str, Any]:
    report = {
        'dataset': validation_report['dataset'],
        'dataset_dir': validation_report['dataset_dir'],
        'class_mapping': class_mapping(),
        'splits': {},
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }

    for split in SPLIT_NAMES:
        labels = collect_labels(config.dataset_dir / split)
        counts = Counter(labels)
        total = len(labels)
        report['splits'][split] = {
            'total_images': total,
            'class_distribution': {
                class_name: {
                    'image_count': counts[index],
                    'percentage': round((counts[index] / total) * 100, 2) if total else 0.0,
                }
                for index, class_name in enumerate(CLASS_NAMES)
            },
        }

    config.output_dir.mkdir(parents=True, exist_ok=True)
    config.class_distribution_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    logger.info('Saved class distribution report to %s.', config.class_distribution_path)
    return report
