from __future__ import annotations

CLASS_NAMES: tuple[str, ...] = (
    'MildDemented',
    'ModerateDemented',
    'NonDemented',
    'VeryMildDemented',
)

NUM_CLASSES = len(CLASS_NAMES)


def class_mapping() -> dict[str, int]:
    return {class_name: index for index, class_name in enumerate(CLASS_NAMES)}
