from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

EXPECTED_CLASSES = (
    'MildDemented',
    'ModerateDemented',
    'NonDemented',
    'VeryMildDemented',
)

IMAGE_EXTENSIONS = {
    '.jpg',
    '.jpeg',
    '.png',
    '.bmp',
    '.tif',
    '.tiff',
}


def is_image_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS


def find_image_files(class_dir: Path) -> list[Path]:
    return sorted(path for path in class_dir.rglob('*') if is_image_file(path))


def image_is_corrupt(path: Path) -> tuple[bool, str | None]:
    try:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            image.load()
        return False, None
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        return True, str(exc)


def write_json_report(report: dict[str, Any], report_path: Path | str | None) -> None:
    if not report_path:
        return

    destination = Path(report_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2), encoding='utf-8')


def validate_dataset(dataset_dir: Path | str, report_path: Path | str | None = None) -> dict[str, Any]:
    root = Path(dataset_dir)
    if not root.exists():
        raise FileNotFoundError(f'Dataset directory does not exist: {root}')
    if not root.is_dir():
        raise NotADirectoryError(f'Dataset path is not a directory: {root}')

    top_level_dirs = {path.name for path in root.iterdir() if path.is_dir()}
    expected = set(EXPECTED_CLASSES)
    missing_classes = sorted(expected - top_level_dirs)
    unexpected_classes = sorted(top_level_dirs - expected)

    class_reports: dict[str, dict[str, Any]] = {}
    total_images = 0
    total_corrupt = 0

    for class_name in EXPECTED_CLASSES:
        class_dir = root / class_name
        image_paths = find_image_files(class_dir) if class_dir.exists() else []
        corrupt_images: list[dict[str, str]] = []

        for image_path in image_paths:
            corrupt, reason = image_is_corrupt(image_path)
            if corrupt:
                corrupt_images.append(
                    {
                        'path': str(image_path),
                        'reason': reason or 'Image could not be decoded',
                    }
                )

        image_count = len(image_paths)
        corrupt_count = len(corrupt_images)
        valid_count = image_count - corrupt_count
        total_images += image_count
        total_corrupt += corrupt_count

        class_reports[class_name] = {
            'class_dir': str(class_dir),
            'exists': class_dir.exists(),
            'image_count': image_count,
            'valid_images': valid_count,
            'corrupt_images': corrupt_count,
            'corrupt_files': corrupt_images,
        }

    empty_classes = [
        class_name
        for class_name, class_report in class_reports.items()
        if class_report['exists'] and class_report['image_count'] == 0
    ]
    valid = not missing_classes and not unexpected_classes and not empty_classes and total_corrupt == 0

    report = {
        'dataset': 'OASIS Dementia MRI Dataset',
        'dataset_dir': str(root),
        'valid': valid,
        'expected_classes': list(EXPECTED_CLASSES),
        'missing_classes': missing_classes,
        'unexpected_classes': unexpected_classes,
        'empty_classes': empty_classes,
        'total_images': total_images,
        'valid_images': total_images - total_corrupt,
        'corrupt_images': total_corrupt,
        'classes': class_reports,
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }

    write_json_report(report, report_path)
    logger.info(
        'dataset_validation_completed',
        extra={
            'dataset_dir': str(root),
            'valid': valid,
            'total_images': total_images,
            'corrupt_images': total_corrupt,
        },
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description='Validate OASIS Dementia MRI dataset structure and images.')
    parser.add_argument('dataset_dir', help='Path to raw dataset directory containing class folders.')
    parser.add_argument(
        '--report',
        default='dataset_validation_report.json',
        help='Path to write JSON validation report.',
    )
    args = parser.parse_args()

    report = validate_dataset(args.dataset_dir, args.report)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
