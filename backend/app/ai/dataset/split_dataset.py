from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import random
import shutil
from typing import Any

from .dataset_stats import generate_dataset_stats
from .dataset_validator import EXPECTED_CLASSES, find_image_files, validate_dataset, write_json_report

SPLIT_NAMES = ('train', 'validation', 'test')


def _validate_ratios(train_ratio: float, validation_ratio: float, test_ratio: float) -> None:
    ratios = (train_ratio, validation_ratio, test_ratio)
    if any(ratio < 0 for ratio in ratios):
        raise ValueError('Split ratios must be non-negative')

    total = sum(ratios)
    if abs(total - 1.0) > 0.0001:
        raise ValueError('Split ratios must sum to 1.0')


def _split_counts(total: int, train_ratio: float, validation_ratio: float, test_ratio: float) -> tuple[int, int, int]:
    if total == 0:
        return 0, 0, 0

    validation_count = round(total * validation_ratio)
    test_count = round(total * test_ratio)

    if total >= 3:
        if validation_ratio > 0:
            validation_count = max(1, validation_count)
        if test_ratio > 0:
            test_count = max(1, test_count)

    if validation_count + test_count >= total:
        overflow = validation_count + test_count - total + 1
        while overflow > 0 and validation_count > 0:
            validation_count -= 1
            overflow -= 1
        while overflow > 0 and test_count > 0:
            test_count -= 1
            overflow -= 1

    train_count = total - validation_count - test_count
    return train_count, validation_count, test_count


def _safe_destination(destination_dir: Path, source_path: Path) -> Path:
    destination = destination_dir / source_path.name
    if not destination.exists():
        return destination

    stem = source_path.stem
    suffix = source_path.suffix
    counter = 1
    while True:
        candidate = destination_dir / f'{stem}_{counter}{suffix}'
        if not candidate.exists():
            return candidate
        counter += 1


def _prepare_output_dir(output_dir: Path, overwrite: bool) -> None:
    if output_dir.exists() and any(output_dir.iterdir()):
        if not overwrite:
            raise FileExistsError(
                f'Output directory is not empty: {output_dir}. Use --overwrite to replace it.'
            )
        shutil.rmtree(output_dir)

    for split in SPLIT_NAMES:
        for class_name in EXPECTED_CLASSES:
            (output_dir / split / class_name).mkdir(parents=True, exist_ok=True)


def create_dataset_split(
    source_dir: Path | str,
    output_dir: Path | str = 'dataset',
    train_ratio: float = 0.70,
    validation_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
    overwrite: bool = False,
    copy_files: bool = True,
    report_path: Path | str | None = None,
) -> dict[str, Any]:
    _validate_ratios(train_ratio, validation_ratio, test_ratio)

    source = Path(source_dir)
    output = Path(output_dir)
    validation_report = validate_dataset(source)

    if not validation_report['valid']:
        raise ValueError(
            'Dataset validation failed. Fix missing classes, unexpected classes, empty classes, '
            'or corrupt images before creating a split.'
        )

    _prepare_output_dir(output, overwrite=overwrite)
    rng = random.Random(seed)
    split_report: dict[str, Any] = {
        'dataset': 'OASIS Dementia MRI Dataset',
        'source_dir': str(source),
        'output_dir': str(output),
        'ratios': {
            'train': train_ratio,
            'validation': validation_ratio,
            'test': test_ratio,
        },
        'seed': seed,
        'operation': 'copy' if copy_files else 'move',
        'classes': {},
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }

    for class_name in EXPECTED_CLASSES:
        image_paths = find_image_files(source / class_name)
        rng.shuffle(image_paths)

        train_count, validation_count, test_count = _split_counts(
            len(image_paths),
            train_ratio,
            validation_ratio,
            test_ratio,
        )
        split_assignments = {
            'train': image_paths[:train_count],
            'validation': image_paths[train_count:train_count + validation_count],
            'test': image_paths[train_count + validation_count:train_count + validation_count + test_count],
        }

        class_distribution: dict[str, int] = {}
        for split, split_paths in split_assignments.items():
            destination_dir = output / split / class_name
            class_distribution[split] = len(split_paths)
            for source_path in split_paths:
                destination = _safe_destination(destination_dir, source_path)
                if copy_files:
                    shutil.copy2(source_path, destination)
                else:
                    shutil.move(str(source_path), str(destination))

        split_report['classes'][class_name] = {
            'total_images': len(image_paths),
            **class_distribution,
        }

    distribution_report = generate_dataset_stats(output)
    split_report['distribution_report'] = distribution_report

    default_report_path = output / 'split_report.json'
    write_json_report(split_report, report_path or default_report_path)
    write_json_report(distribution_report, output / 'class_distribution_report.json')

    return split_report


def main() -> None:
    parser = argparse.ArgumentParser(description='Create train/validation/test split for OASIS Dementia MRI dataset.')
    parser.add_argument('source_dir', help='Path to raw dataset directory containing class folders.')
    parser.add_argument(
        '--output',
        default='dataset',
        help='Output directory. Defaults to ./dataset.',
    )
    parser.add_argument('--train-ratio', type=float, default=0.70)
    parser.add_argument('--validation-ratio', type=float, default=0.15)
    parser.add_argument('--test-ratio', type=float, default=0.15)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--overwrite', action='store_true')
    parser.add_argument(
        '--move',
        action='store_true',
        help='Move files instead of copying them. Copy is the default and recommended option.',
    )
    parser.add_argument('--report', default=None, help='Optional path for split report JSON.')
    args = parser.parse_args()

    report = create_dataset_split(
        source_dir=args.source_dir,
        output_dir=args.output,
        train_ratio=args.train_ratio,
        validation_ratio=args.validation_ratio,
        test_ratio=args.test_ratio,
        seed=args.seed,
        overwrite=args.overwrite,
        copy_files=not args.move,
        report_path=args.report,
    )
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
