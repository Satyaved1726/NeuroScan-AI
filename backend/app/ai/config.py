from __future__ import annotations

import logging
import os
import random
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import tensorflow as tf


PROJECT_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class TrainingConfig:
    dataset_dir: Path = PROJECT_ROOT / 'dataset'
    output_dir: Path = (
        Path(os.environ["MODEL_DIR"]).resolve()
        if os.environ.get("MODEL_DIR")
        else PROJECT_ROOT / "model"
    )
    image_size: tuple[int, int] = (224, 224)
    input_shape: tuple[int, int, int] = (224, 224, 3)
    batch_size: int = 32
    epochs: int = 50
    learning_rate: float = 0.0001
    random_seed: int = 42
    dropout_rate: float = 0.4
    dense_units: int = 256
    tensorboard_log_dir_name: str = 'tensorboard'

    @property
    def model_path(self) -> Path:
        return self.output_dir / 'dementia_model.keras'

    @property
    def class_mapping_path(self) -> Path:
        return self.output_dir / 'class_mapping.json'

    @property
    def training_history_path(self) -> Path:
        return self.output_dir / 'training_history.json'

    @property
    def evaluation_metrics_path(self) -> Path:
        return self.output_dir / 'evaluation_metrics.json'

    @property
    def confusion_matrix_path(self) -> Path:
        return self.output_dir / 'confusion_matrix.png'

    @property
    def classification_report_path(self) -> Path:
        return self.output_dir / 'classification_report.json'

    @property
    def class_distribution_path(self) -> Path:
        return self.output_dir / 'class_distribution_report.json'

    @property
    def tensorboard_log_dir(self) -> Path:
        return self.output_dir / self.tensorboard_log_dir_name


def configure_tensorflow_runtime() -> None:
    """Configure TensorFlow for low-memory CPU execution on resource-constrained containers (e.g. Render)."""
    os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
    os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
    os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
    os.environ['OMP_NUM_THREADS'] = '1'
    os.environ['TF_NUM_INTRAOP_THREADS'] = '1'
    os.environ['TF_NUM_INTEROP_THREADS'] = '1'

    try:
        tf.config.set_visible_devices([], 'GPU')
    except Exception:
        pass
    try:
        tf.config.threading.set_intra_op_parallelism_threads(1)
        tf.config.threading.set_inter_op_parallelism_threads(1)
    except Exception:
        pass


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s %(levelname)s %(name)s - %(message)s',
    )


def set_reproducible_seeds(seed: int) -> None:
    os.environ['PYTHONHASHSEED'] = str(seed)
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)
    try:
        tf.config.experimental.enable_op_determinism()
    except Exception:
        logging.getLogger(__name__).debug('TensorFlow deterministic ops are unavailable on this runtime.')


def detect_compute_device() -> str:
    if os.environ.get('CUDA_VISIBLE_DEVICES') == '-1':
        return 'CPU (Low-memory container mode)'
    physical_gpus = tf.config.list_physical_devices('GPU')
    if physical_gpus:
        for gpu in physical_gpus:
            try:
                tf.config.experimental.set_memory_growth(gpu, True)
            except RuntimeError:
                pass
        return f'CUDA/Metal GPU ({len(physical_gpus)} device(s))'

    try:
        built_with_cuda = tf.test.is_built_with_cuda()
    except Exception:
        built_with_cuda = False

    if built_with_cuda:
        return 'CUDA runtime available, no GPU detected'
    if 'arm' in os.uname().machine.lower() if hasattr(os, 'uname') else False:
        return 'Apple Silicon/ARM CPU runtime'
    return 'CPU'
