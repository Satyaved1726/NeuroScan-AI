from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

from .dataset_validator import EXPECTED_CLASSES, find_image_files, image_is_corrupt, write_json_report

SPLIT_NAMES = ('train', 'validation', 'test')


def _class_counts(dataset_dir: Path) -> dict[str, dict[str, Any]]:
    counts: dict[str, dict[str, Any]] = {}
    for class_name in EXPECTED_CLASSES:
        class_dir = dataset_dir / class_name
        image_paths = find_image_files(class_dir) if class_dir.exists() else []
        corrupt_count = sum(1 for path in image_paths if image_is_corrupt(path)[0])
        counts[class_name] = {
            'image_count': len(image_paths),
            'valid_images': len(image_paths) - corrupt_count,
            'corrupt_images': corrupt_count,
        }
    return counts


def _with_percentages(counts: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    total = sum(item['image_count'] for item in counts.values())
    distribution: dict[str, dict[str, Any]] = {}
    for class_name in EXPECTED_CLASSES:
        image_count = counts[class_name]['image_count']
        distribution[class_name] = {
            **counts[class_name],
            'percentage': round((image_count / total) * 100, 2) if total else 0.0,
        }
    return distribution


def generate_dataset_stats(dataset_dir: Path | str, report_path: Path | str | None = None) -> dict[str, Any]:
    root = Path(dataset_dir)
    if not root.exists():
        raise FileNotFoundError(f'Dataset directory does not exist: {root}')
    if not root.is_dir():
        raise NotADirectoryError(f'Dataset path is not a directory: {root}')

    has_split_structure = all((root / split).is_dir() for split in SPLIT_NAMES)
    report: dict[str, Any] = {
        'dataset': 'OASIS Dementia MRI Dataset',
        'dataset_dir': str(root),
        'expected_classes': list(EXPECTED_CLASSES),
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }

    if has_split_structure:
        split_reports: dict[str, Any] = {}
        total_images = 0
        total_corrupt = 0

        for split in SPLIT_NAMES:
            counts = _class_counts(root / split)
            split_total = sum(item['image_count'] for item in counts.values())
            split_corrupt = sum(item['corrupt_images'] for item in counts.values())
            total_images += split_total
            total_corrupt += split_corrupt
            split_reports[split] = {
                'total_images': split_total,
                'valid_images': split_total - split_corrupt,
                'corrupt_images': split_corrupt,
                'class_distribution': _with_percentages(counts),
            }

        report.update(
            {
                'split_structure': True,
                'total_images': total_images,
                'valid_images': total_images - total_corrupt,
                'corrupt_images': total_corrupt,
                'splits': split_reports,
            }
        )
    else:
        counts = _class_counts(root)
        total_images = sum(item['image_count'] for item in counts.values())
        total_corrupt = sum(item['corrupt_images'] for item in counts.values())
        report.update(
            {
                'split_structure': False,
                'total_images': total_images,
                'valid_images': total_images - total_corrupt,
                'corrupt_images': total_corrupt,
                'class_distribution': _with_percentages(counts),
            }
        )

    write_json_report(report, report_path)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description='Generate OASIS Dementia MRI class distribution statistics.')
    parser.add_argument('dataset_dir', help='Path to raw or split dataset directory.')
    parser.add_argument(
        '--report',
        default='dataset_class_distribution_report.json',
        help='Path to write JSON class distribution report.',
    )
    args = parser.parse_args()

    report = generate_dataset_stats(args.dataset_dir, args.report)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
