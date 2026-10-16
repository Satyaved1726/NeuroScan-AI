from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import gc
import json
import logging
from pathlib import Path
from threading import Lock
from time import perf_counter

import numpy as np
import tensorflow as tf
from PIL import Image, UnidentifiedImageError

from .config import TrainingConfig, configure_tensorflow_runtime
from .inference import _probabilities_from_model_output, get_model_service

configure_tensorflow_runtime()

logger = logging.getLogger(__name__)


class GradCAMError(RuntimeError):
    pass


@dataclass(frozen=True)
class GradCAMOutput:
    prediction: str
    heatmap_png: bytes
    target_layer: str


class GradCAMService:
    _instance: GradCAMService | None = None
    _instance_lock = Lock()

    def __new__(cls) -> GradCAMService:
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
        self._grad_model: tf.keras.Model | None = None
        self._feature_model: tf.keras.Model | None = None
        self._base_model: tf.keras.Model | None = None
        self._classes: list[str] = []
        self._target_layer_name: str | None = None
        self._load_lock = Lock()
        self._generate_lock = Lock()
        self._initialized = True

    def load(self) -> None:
        if self._model is not None and (self._grad_model is not None or self._feature_model is not None):
            return

        with self._load_lock:
            if self._model is not None and (self._grad_model is not None or self._feature_model is not None):
                return

            started_at = perf_counter()
            logger.info(
                'gradcam_model_preparing',
                extra={'source': 'shared_prediction_model'},
            )
            model_service = get_model_service()
            model = model_service.model
            base_model, target_layer = _find_target_layer(model)
            self._classes = model_service.classes
            if base_model is model:
                self._grad_model = tf.keras.Model(
                    inputs=model.inputs,
                    outputs=[target_layer.output, model.outputs[0]],
                    name='gradcam_feature_model',
                )
            else:
                self._feature_model = tf.keras.Model(
                    inputs=base_model.inputs,
                    outputs=[target_layer.output, base_model.outputs[0]],
                    name='gradcam_feature_model',
                )
                self._base_model = base_model
            self._model = model
            self._target_layer_name = target_layer.name
            load_ms = round((perf_counter() - started_at) * 1000, 2)
            logger.info(
                'gradcam_model_loaded',
                extra={'target_layer': target_layer.name, 'class_count': len(self._classes), 'load_ms': load_ms},
            )

    def generate(self, image_bytes: bytes) -> GradCAMOutput:
        total_started_at = perf_counter()
        self.load()
        if self._grad_model is None and (self._feature_model is None or self._base_model is None):
            raise GradCAMError('Grad-CAM model is unavailable')
        if self._target_layer_name is None:
            raise GradCAMError('Grad-CAM model is unavailable')

        preprocess_started_at = perf_counter()
        image_batch, original_image = _preprocess_for_gradcam(image_bytes, self._config)
        preprocess_ms = round((perf_counter() - preprocess_started_at) * 1000, 2)
        heatmap_started_at = perf_counter()
        model_service = get_model_service()
        with model_service._predict_lock:
            with self._generate_lock:
                heatmap, prediction = self._compute_heatmap(image_batch)
        heatmap_ms = round((perf_counter() - heatmap_started_at) * 1000, 2)

        overlay_started_at = perf_counter()
        overlay_png = _overlay_heatmap(original_image, heatmap)
        overlay_ms = round((perf_counter() - overlay_started_at) * 1000, 2)
        total_ms = round((perf_counter() - total_started_at) * 1000, 2)
        del image_batch, original_image, heatmap
        gc.collect()
        logger.info(
            'gradcam_generation_timing',
            extra={
                'preprocess_ms': preprocess_ms,
                'heatmap_ms': heatmap_ms,
                'overlay_ms': overlay_ms,
                'total_ms': total_ms,
                'prediction': prediction,
                'target_layer': self._target_layer_name,
            },
        )
        return GradCAMOutput(
            prediction=prediction,
            heatmap_png=overlay_png,
            target_layer=self._target_layer_name,
        )

    def _compute_heatmap(self, image_batch: np.ndarray) -> tuple[np.ndarray, str]:
        if self._model is None:
            raise GradCAMError('Grad-CAM model is unavailable')

        image_tensor = tf.convert_to_tensor(image_batch, dtype=tf.float32)
        with tf.GradientTape() as tape:
            if self._grad_model is not None:
                conv_outputs, predictions = self._grad_model(image_tensor, training=False)
            elif self._feature_model is not None and self._base_model is not None:
                conv_outputs, predictions = _forward_with_features(
                    self._model,
                    self._base_model,
                    self._feature_model,
                    image_tensor,
                )
            else:
                raise GradCAMError('Grad-CAM model is unavailable')
            predictions = tf.convert_to_tensor(predictions)
            probabilities = _probabilities_from_model_output(np.asarray(predictions[0], dtype=np.float32))
            class_index = int(np.argmax(probabilities))
            class_score = predictions[:, class_index]

        gradients = tape.gradient(class_score, conv_outputs)
        del tape
        if gradients is None:
            raise GradCAMError('Failed to calculate Grad-CAM gradients')

        pooled_gradients = tf.reduce_mean(gradients, axis=(0, 1, 2))
        conv_outputs = conv_outputs[0]
        heatmap = tf.reduce_sum(conv_outputs * pooled_gradients, axis=-1)
        heatmap = tf.nn.relu(heatmap)
        max_value = tf.reduce_max(heatmap)
        if float(max_value) <= 0.0:
            raise GradCAMError('Grad-CAM heatmap has no positive activation')

        heatmap = heatmap / max_value
        if probabilities.shape[0] != len(self._classes):
            raise GradCAMError(f'Model returned {probabilities.shape[0]} classes, expected {len(self._classes)}')

        result_heatmap = heatmap.numpy()
        del image_tensor, gradients, pooled_gradients, conv_outputs, heatmap
        return result_heatmap, self._classes[class_index]


def get_gradcam_service() -> GradCAMService:
    return GradCAMService()


def _forward_with_features(
    model: tf.keras.Model,
    base_model: tf.keras.Model,
    feature_model: tf.keras.Model,
    image_tensor: tf.Tensor,
) -> tuple[tf.Tensor, tf.Tensor]:
    x = image_tensor
    conv_outputs = None

    for layer in model.layers:
        if isinstance(layer, tf.keras.layers.InputLayer):
            continue
        if layer is base_model:
            conv_outputs, x = feature_model(x, training=False)
            continue
        x = _call_inference_layer(layer, x)

    if conv_outputs is None:
        raise GradCAMError('Grad-CAM feature layer was not reached during inference')
    return conv_outputs, x


def _call_inference_layer(layer: tf.keras.layers.Layer, inputs: tf.Tensor) -> tf.Tensor:
    try:
        return layer(inputs, training=False)
    except TypeError:
        return layer(inputs)


def _find_target_layer(model: tf.keras.Model) -> tuple[tf.keras.Model, tf.keras.layers.Layer]:
    preferred_names = ('top_conv', 'block7a_project_conv')
    candidate_models = [layer for layer in model.layers if isinstance(layer, tf.keras.Model)]
    if isinstance(model, tf.keras.Model):
        candidate_models.append(model)

    for candidate_model in candidate_models:
        for layer_name in preferred_names:
            try:
                layer = candidate_model.get_layer(layer_name)
                if _is_spatial_layer(layer):
                    return candidate_model, layer
            except ValueError:
                continue

    for candidate_model in candidate_models:
        for layer in reversed(candidate_model.layers):
            if _is_spatial_layer(layer):
                return candidate_model, layer

    raise GradCAMError('No spatial convolutional layer found for Grad-CAM')


def _is_spatial_layer(layer: tf.keras.layers.Layer) -> bool:
    try:
        output_shape = layer.output.shape
    except AttributeError:
        return False

    return len(output_shape) == 4 and isinstance(
        layer,
        (
            tf.keras.layers.Conv2D,
            tf.keras.layers.DepthwiseConv2D,
            tf.keras.layers.SeparableConv2D,
        ),
    )


def _preprocess_for_gradcam(image_bytes: bytes, config: TrainingConfig) -> tuple[np.ndarray, Image.Image]:
    if not image_bytes:
        raise GradCAMError('Empty MRI image received')

    try:
        with Image.open(BytesIO(image_bytes)) as image:
            original_image = image.convert('RGB')
            resized_image = original_image.resize(config.image_size, Image.Resampling.BILINEAR)
            array = np.asarray(resized_image, dtype=np.float32)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise GradCAMError('MRI image could not be decoded') from exc

    return np.expand_dims(array, axis=0), original_image


def _overlay_heatmap(original_image: Image.Image, heatmap: np.ndarray, alpha: float = 0.42) -> bytes:
    heatmap_image = Image.fromarray(np.uint8(np.clip(heatmap, 0.0, 1.0) * 255), mode='L')
    heatmap_image = heatmap_image.resize(original_image.size, Image.Resampling.BILINEAR)
    heatmap_array = np.asarray(heatmap_image, dtype=np.float32) / 255.0
    color_heatmap = _jet_colormap(heatmap_array)

    original_array = np.asarray(original_image, dtype=np.float32)
    blended = (1.0 - alpha) * original_array + alpha * color_heatmap
    blended = np.clip(blended, 0, 255).astype(np.uint8)

    output = BytesIO()
    Image.fromarray(blended, mode='RGB').save(output, format='PNG', optimize=True)
    return output.getvalue()


def _jet_colormap(values: np.ndarray) -> np.ndarray:
    red = np.clip(1.5 - np.abs(4.0 * values - 3.0), 0.0, 1.0)
    green = np.clip(1.5 - np.abs(4.0 * values - 2.0), 0.0, 1.0)
    blue = np.clip(1.5 - np.abs(4.0 * values - 1.0), 0.0, 1.0)
    return np.stack([red, green, blue], axis=-1) * 255.0


def _load_class_names(path: Path) -> list[str]:
    try:
        raw_mapping = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as exc:
        raise GradCAMError(f'Failed to read class mapping: {path}') from exc

    if isinstance(raw_mapping, list) and all(isinstance(item, str) for item in raw_mapping):
        return raw_mapping

    if isinstance(raw_mapping, dict):
        if all(isinstance(value, int) for value in raw_mapping.values()):
            return [name for name, _ in sorted(raw_mapping.items(), key=lambda item: item[1])]
        if all(str(key).isdigit() and isinstance(value, str) for key, value in raw_mapping.items()):
            return [raw_mapping[key] for key in sorted(raw_mapping, key=lambda item: int(item))]

    raise GradCAMError('Unsupported class mapping format')
