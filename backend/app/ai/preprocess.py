from __future__ import annotations

import tensorflow as tf

from .config import TrainingConfig


def build_training_augmentation(config: TrainingConfig) -> tf.keras.Sequential:
    return tf.keras.Sequential(
        [
            tf.keras.layers.RandomRotation(0.08, seed=config.random_seed),
            tf.keras.layers.RandomZoom(0.12, seed=config.random_seed),
            tf.keras.layers.RandomTranslation(0.08, 0.08, seed=config.random_seed),
            tf.keras.layers.RandomFlip('horizontal', seed=config.random_seed),
            tf.keras.layers.RandomBrightness(0.12, seed=config.random_seed),
        ],
        name='training_augmentation',
    )


def resize_and_prepare(image: tf.Tensor, label: tf.Tensor, config: TrainingConfig) -> tuple[tf.Tensor, tf.Tensor]:
    image = tf.image.resize(image, config.image_size)
    image = tf.image.grayscale_to_rgb(image) if image.shape.rank == 3 and image.shape[-1] == 1 else image
    image = tf.cast(image, tf.float32)
    return image, label


def configure_for_performance(dataset: tf.data.Dataset, shuffle: bool = False, seed: int = 42) -> tf.data.Dataset:
    if shuffle:
        dataset = dataset.shuffle(buffer_size=1024, seed=seed, reshuffle_each_iteration=True)
    return dataset.prefetch(tf.data.AUTOTUNE)
