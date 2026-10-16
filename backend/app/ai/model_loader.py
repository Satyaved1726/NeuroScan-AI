from __future__ import annotations

from pathlib import Path

import tensorflow as tf

from .classes import NUM_CLASSES
from .config import TrainingConfig
from .preprocess import build_training_augmentation


@tf.keras.utils.register_keras_serializable(package='NeuroScanAI')
class MacroConfusionMetric(tf.keras.metrics.Metric):
    def __init__(self, num_classes: int = NUM_CLASSES, name: str = 'macro_confusion_metric', **kwargs):
        super().__init__(name=name, **kwargs)
        self.num_classes = num_classes
        self.true_positives = self.add_weight(name='tp', shape=(num_classes,), initializer='zeros')
        self.false_positives = self.add_weight(name='fp', shape=(num_classes,), initializer='zeros')
        self.false_negatives = self.add_weight(name='fn', shape=(num_classes,), initializer='zeros')

    def update_state(self, y_true, y_pred, sample_weight=None):
        y_true = tf.argmax(y_true, axis=-1)
        y_pred = tf.argmax(y_pred, axis=-1)
        y_true_one_hot = tf.one_hot(y_true, depth=self.num_classes)
        y_pred_one_hot = tf.one_hot(y_pred, depth=self.num_classes)
        inverse_y_true = tf.ones_like(y_true_one_hot) - y_true_one_hot
        inverse_y_pred = tf.ones_like(y_pred_one_hot) - y_pred_one_hot

        self.true_positives.assign_add(tf.reduce_sum(y_true_one_hot * y_pred_one_hot, axis=0))
        self.false_positives.assign_add(tf.reduce_sum(inverse_y_true * y_pred_one_hot, axis=0))
        self.false_negatives.assign_add(tf.reduce_sum(y_true_one_hot * inverse_y_pred, axis=0))

    def reset_state(self):
        for variable in self.variables:
            variable.assign(tf.zeros_like(variable))

    def get_config(self):
        config = super().get_config()
        config.update({'num_classes': self.num_classes})
        return config


@tf.keras.utils.register_keras_serializable(package='NeuroScanAI')
class MacroPrecision(MacroConfusionMetric):
    def __init__(self, num_classes: int = NUM_CLASSES, name: str = 'precision', **kwargs):
        super().__init__(num_classes=num_classes, name=name, **kwargs)

    def result(self):
        precision = self.true_positives / (self.true_positives + self.false_positives + tf.keras.backend.epsilon())
        return tf.reduce_mean(precision)


@tf.keras.utils.register_keras_serializable(package='NeuroScanAI')
class MacroRecall(MacroConfusionMetric):
    def __init__(self, num_classes: int = NUM_CLASSES, name: str = 'recall', **kwargs):
        super().__init__(num_classes=num_classes, name=name, **kwargs)

    def result(self):
        recall = self.true_positives / (self.true_positives + self.false_negatives + tf.keras.backend.epsilon())
        return tf.reduce_mean(recall)


@tf.keras.utils.register_keras_serializable(package='NeuroScanAI')
class MacroF1Score(MacroConfusionMetric):
    def __init__(self, num_classes: int = NUM_CLASSES, name: str = 'f1_score', **kwargs):
        super().__init__(num_classes=num_classes, name=name, **kwargs)

    def result(self):
        precision = self.true_positives / (self.true_positives + self.false_positives + tf.keras.backend.epsilon())
        recall = self.true_positives / (self.true_positives + self.false_negatives + tf.keras.backend.epsilon())
        f1 = 2 * precision * recall / (precision + recall + tf.keras.backend.epsilon())
        return tf.reduce_mean(f1)


def build_model(config: TrainingConfig) -> tf.keras.Model:
    inputs = tf.keras.Input(shape=config.input_shape, name='mri_image')
    x = build_training_augmentation(config)(inputs)
    x = tf.keras.applications.efficientnet.preprocess_input(x)

    base_model = tf.keras.applications.EfficientNetB0(
        include_top=False,
        weights='imagenet',
        input_shape=config.input_shape,
    )
    base_model.trainable = False

    x = base_model(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D(name='global_average_pooling')(x)
    x = tf.keras.layers.BatchNormalization(name='batch_normalization')(x)
    x = tf.keras.layers.Dropout(config.dropout_rate, name='dropout')(x)
    x = tf.keras.layers.Dense(config.dense_units, activation='relu', name='dense_features')(x)
    outputs = tf.keras.layers.Dense(NUM_CLASSES, activation='softmax', name='dementia_class')(x)

    model = tf.keras.Model(inputs=inputs, outputs=outputs, name='efficientnetb0_dementia_classifier')
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=config.learning_rate),
        loss='categorical_crossentropy',
        metrics=[
            tf.keras.metrics.CategoricalAccuracy(name='accuracy'),
            MacroPrecision(name='precision'),
            MacroRecall(name='recall'),
            MacroF1Score(name='f1_score'),
        ],
    )
    return model


def load_trained_model(model_path: Path | str, compile: bool = False) -> tf.keras.Model:
    custom_objects = {
        'MacroConfusionMetric': MacroConfusionMetric,
        'MacroPrecision': MacroPrecision,
        'MacroRecall': MacroRecall,
        'MacroF1Score': MacroF1Score,
    } if compile else None

    return tf.keras.models.load_model(
        model_path,
        compile=compile,
        custom_objects=custom_objects,
    )
