from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import json
import logging
from pathlib import Path
from threading import Lock
from time import perf_counter

import numpy as np
import tensorflow as tf
from PIL import Image, UnidentifiedImageError

from .classes import NUM_CLASSES
from .config import TrainingConfig
from .model_loader import load_trained_model

logger = logging.getLogger(__name__)


class MRIInferenceError(RuntimeError):
    pass


@dataclass(frozen=True)
class PredictionOutput:
    prediction: str
    confidence: float
    probabilities: dict[str, float]
    risk_score: int
    risk_category: str
    timing_ms: dict[str, float]


class MRIModelService:
    _instance: MRIModelService | None = None
    _instance_lock = Lock()

    def __new__(cls) -> MRIModelService:
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._config = TrainingConfig()
        self._model: tf.keras.Model | None = None
        self._classes: list[str] = []
        self._load_lock = Lock()
        self._predict_lock = Lock()
        self._initialized = True

    def load(self) -> None:
        if self._model is not None:
            return

        with self._load_lock:
            if self._model is not None:
                return

            model_path = self._config.model_path
            mapping_path = self._config.class_mapping_path
            if not model_path.exists():
                raise MRIInferenceError(f'Model file not found: {model_path}')
            if not mapping_path.exists():
                raise MRIInferenceError(f'Class mapping file not found: {mapping_path}')

            logger.info(
                'loading_mri_prediction_model',
                extra={'model_path': str(model_path), 'class_mapping_path': str(mapping_path)},
            )
            started_at = perf_counter()
            self._classes = _load_class_names(mapping_path)
            if len(self._classes) != NUM_CLASSES:
                raise MRIInferenceError(
                    f'Class mapping contains {len(self._classes)} classes, expected {NUM_CLASSES}'
                )
            self._model = load_trained_model(model_path)
            output_shape = self._model.output_shape
            output_classes = output_shape[-1] if isinstance(output_shape, tuple) else None
            if output_classes != len(self._classes):
                raise MRIInferenceError(
                    f'Model output has {output_classes} classes, expected {len(self._classes)}'
                )
            load_ms = round((perf_counter() - started_at) * 1000, 2)
            logger.info(
                'mri_prediction_model_loaded',
                extra={'class_count': len(self._classes), 'classes': self._classes, 'load_ms': load_ms},
            )

            # Warm up the model JIT compile and layers with dummy prediction
            try:
                logger.info("Warming up TensorFlow model with a dummy prediction...")
                warmup_started = perf_counter()
                dummy_input = np.zeros((1, *self._config.image_size, 3), dtype=np.float32)
                self._model.predict(dummy_input, verbose=0)
                warmup_ms = round((perf_counter() - warmup_started) * 1000, 2)
                logger.info(f"Model warm-up completed in {warmup_ms}ms")
            except Exception as warmup_err:
                logger.warning(f"Failed to warm up TensorFlow model: {warmup_err}")

    @property
    def model(self) -> tf.keras.Model:
        self.load()
        if self._model is None:
            raise MRIInferenceError('MRI prediction model is unavailable')
        return self._model

    @property
    def classes(self) -> list[str]:
        self.load()
        return list(self._classes)

    def predict(self, image_bytes: bytes) -> PredictionOutput:
        total_started_at = perf_counter()
        model_was_loaded = self._model is not None
        load_started_at = perf_counter()
        self.load()
        model_load_ms = 0.0 if model_was_loaded else round((perf_counter() - load_started_at) * 1000, 2)
        if self._model is None:
            raise MRIInferenceError('MRI prediction model is unavailable')

        preprocess_started_at = perf_counter()
        image_batch = preprocess_image_bytes(image_bytes, self._config)
        preprocess_ms = round((perf_counter() - preprocess_started_at) * 1000, 2)
        inference_started_at = perf_counter()
        with self._predict_lock:
            raw_predictions = self._model.predict(image_batch, verbose=0)
        inference_ms = round((perf_counter() - inference_started_at) * 1000, 2)

        probabilities_array = np.asarray(raw_predictions, dtype=np.float32)[0]
        if probabilities_array.shape[0] != len(self._classes):
            raise MRIInferenceError(
                f'Model returned {probabilities_array.shape[0]} classes, expected {len(self._classes)}'
            )

        probabilities_array = _probabilities_from_model_output(probabilities_array)
        top_index = int(np.argmax(probabilities_array))
        prediction = self._classes[top_index]
        probabilities = {
            class_name: round(float(probabilities_array[index] * 100), 2)
            for index, class_name in enumerate(self._classes)
        }
        confidence = probabilities[prediction]
        risk_score = calculate_risk_score(probabilities_array, self._classes)
        total_ms = round((perf_counter() - total_started_at) * 1000, 2)

        logger.info(
            'mri_prediction_inference_timing',
            extra={
                'model_cached': model_was_loaded,
                'model_load_ms': model_load_ms,
                'preprocess_ms': preprocess_ms,
                'inference_ms': inference_ms,
                'total_ms': total_ms,
                'prediction': prediction,
                'confidence': confidence,
            },
        )

        return PredictionOutput(
            prediction=prediction,
            confidence=confidence,
            probabilities=probabilities,
            risk_score=risk_score,
            risk_category=risk_category(risk_score),
            timing_ms={
                'model_load_ms': model_load_ms,
                'preprocess_ms': preprocess_ms,
                'inference_ms': inference_ms,
                'total_ms': total_ms,
            },
        )


def get_model_service() -> MRIModelService:
    return MRIModelService()


def load_model_once() -> None:
    get_model_service().load()


def preprocess_image_bytes(image_bytes: bytes, config: TrainingConfig | None = None) -> np.ndarray:
    if not image_bytes:
        raise MRIInferenceError('Empty MRI image received')

    config = config or TrainingConfig()
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            image = image.convert('RGB')
            image = image.resize(config.image_size, Image.Resampling.BILINEAR)
            array = np.asarray(image, dtype=np.float32)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise MRIInferenceError('MRI image could not be decoded') from exc

    return np.expand_dims(array, axis=0)


def calculate_risk_score(probabilities: np.ndarray, class_names: list[str]) -> int:
    weights = {
        'NonDemented': 0.0,
        'VeryMildDemented': 35.0,
        'MildDemented': 70.0,
        'ModerateDemented': 100.0,
        'Non Demented': 0.0,
        'Very Mild Demented': 35.0,
        'Mild Demented': 70.0,
        'Moderate Demented': 100.0,
    }
    weighted_score = sum(float(probabilities[index]) * weights.get(class_name, 50.0) for index, class_name in enumerate(class_names))
    return int(round(max(0.0, min(100.0, weighted_score))))


def risk_category(risk_score: int) -> str:
    if risk_score < 35:
        return 'Low'
    if risk_score < 60:
        return 'Moderate'
    if risk_score < 85:
        return 'High'
    return 'Critical'


def _load_class_names(path: Path) -> list[str]:
    try:
        raw_mapping = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as exc:
        raise MRIInferenceError(f'Failed to read class mapping: {path}') from exc

    if isinstance(raw_mapping, list) and all(isinstance(item, str) for item in raw_mapping):
        return raw_mapping

    if isinstance(raw_mapping, dict):
        if all(isinstance(value, int) for value in raw_mapping.values()):
            return [name for name, _ in sorted(raw_mapping.items(), key=lambda item: item[1])]
        if all(str(key).isdigit() and isinstance(value, str) for key, value in raw_mapping.items()):
            return [raw_mapping[key] for key in sorted(raw_mapping, key=lambda item: int(item))]

    raise MRIInferenceError('Unsupported class mapping format')


def _probabilities_from_model_output(model_output: np.ndarray) -> np.ndarray:
    values = np.asarray(model_output, dtype=np.float32)
    if values.ndim != 1 or values.size == 0:
        raise MRIInferenceError('Model returned invalid prediction shape')
    if not np.all(np.isfinite(values)):
        raise MRIInferenceError('Model returned non-finite prediction values')

    total = float(values.sum())
    looks_like_probabilities = np.all(values >= 0.0) and np.isclose(total, 1.0, rtol=1e-3, atol=1e-3)
    if looks_like_probabilities:
        probabilities = values
    else:
        shifted = values - np.max(values)
        exp_values = np.exp(shifted)
        exp_total = float(exp_values.sum())
        if exp_total <= 0.0 or not np.isfinite(exp_total):
            raise MRIInferenceError('Model returned invalid probability values')
        probabilities = exp_values / exp_total

    probabilities = np.clip(probabilities.astype(np.float32), 0.0, 1.0)
    normalized_total = float(probabilities.sum())
    if normalized_total <= 0.0:
        raise MRIInferenceError('Model returned invalid probability values')
    return probabilities / normalized_total
