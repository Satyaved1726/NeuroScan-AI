#!/usr/bin/env python3
"""
Automated Verification Tests for NeuroScan AI Class Mapping.

Verifies:
1. Consistency between classes.py, dataset_validator.py, train.py, and model/class_mapping.json.
2. Format of class_mapping.json (JSON list matching the model's 4 output neurons).
3. Inference service class loading and alignment with model output layer.
4. Empirical forward-pass activation of model output neurons against ground-truth test slices.
5. Risk score weighting alignment.
"""

import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

# Ensure backend is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from app.ai.classes import CLASS_NAMES, NUM_CLASSES, class_mapping
from app.ai.config import TrainingConfig
from app.ai.dataset.dataset_validator import EXPECTED_CLASSES
from app.ai.inference import (
    _load_class_names,
    calculate_risk_score,
    get_model_service,
    risk_category,
)
from app.ai.model_loader import load_trained_model


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


EXPECTED_VERIFIED_ORDER = (
    "MildDemented",
    "ModerateDemented",
    "NonDemented",
    "VeryMildDemented",
)


def test_classes_py_definition():
    """Verify classes.py exports the exact verified class order and dictionary mapping."""
    print("[TEST 1] Checking backend/app/ai/classes.py...")
    assert CLASS_NAMES == EXPECTED_VERIFIED_ORDER, (
        f"CLASS_NAMES mismatch: expected {EXPECTED_VERIFIED_ORDER}, got {CLASS_NAMES}"
    )
    assert NUM_CLASSES == 4, f"NUM_CLASSES expected 4, got {NUM_CLASSES}"

    mapping = class_mapping()
    assert isinstance(mapping, dict), "class_mapping() must return a dict"
    for idx, name in enumerate(EXPECTED_VERIFIED_ORDER):
        assert mapping[name] == idx, f"Mapping error: {name} expected index {idx}, got {mapping.get(name)}"
    print("  [PASS] classes.py defines verified order and mapping")


def test_dataset_validator_expected_classes():
    """Verify dataset_validator.py EXPECTED_CLASSES matches classes.py."""
    print("\n[TEST 2] Checking backend/app/ai/dataset/dataset_validator.py...")
    assert EXPECTED_CLASSES == EXPECTED_VERIFIED_ORDER, (
        f"EXPECTED_CLASSES mismatch: expected {EXPECTED_VERIFIED_ORDER}, got {EXPECTED_CLASSES}"
    )
    print("  [PASS] dataset_validator.py matches verified class order")


def test_saved_class_mapping_json_format():
    """Verify model/class_mapping.json exists, is a list, and matches the verified order."""
    print("\n[TEST 3] Checking model/class_mapping.json file...")
    config = TrainingConfig()
    mapping_path = config.class_mapping_path
    assert mapping_path.exists(), f"Class mapping file does not exist: {mapping_path}"

    with open(mapping_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert isinstance(data, list), f"class_mapping.json must be a JSON list, got {type(data).__name__}"
    assert len(data) == 4, f"class_mapping.json must contain 4 classes, got {len(data)}"
    assert tuple(data) == EXPECTED_VERIFIED_ORDER, (
        f"class_mapping.json contents mismatch:\nExpected: {EXPECTED_VERIFIED_ORDER}\nGot:      {tuple(data)}"
    )
    print(f"  [PASS] class_mapping.json is a valid list matching model output neurons: {data}")


def test_inference_class_loader():
    """Verify inference.py correctly loads class names from class_mapping.json."""
    print("\n[TEST 4] Checking backend/app/ai/inference.py class loader...")
    config = TrainingConfig()
    loaded_classes = _load_class_names(config.class_mapping_path)
    assert isinstance(loaded_classes, list), "Loaded classes must be a list"
    assert tuple(loaded_classes) == EXPECTED_VERIFIED_ORDER, (
        f"Loaded classes mismatch: expected {EXPECTED_VERIFIED_ORDER}, got {tuple(loaded_classes)}"
    )

    service = get_model_service()
    assert tuple(service.classes) == EXPECTED_VERIFIED_ORDER, (
        f"MRIModelService.classes mismatch: expected {EXPECTED_VERIFIED_ORDER}, got {tuple(service.classes)}"
    )
    print("  [PASS] inference.py _load_class_names and MRIModelService.classes match")


def test_risk_score_calculation():
    """Verify risk score calculations align with dementia severity weights."""
    print("\n[TEST 5] Checking risk score calculations with verified class order...")
    classes = list(EXPECTED_VERIFIED_ORDER)

    # 100% NonDemented (index 2) -> Risk Score 0 (Low)
    probs_non = np.array([0.0, 0.0, 1.0, 0.0], dtype=np.float32)
    score_non = calculate_risk_score(probs_non, classes)
    assert score_non == 0, f"Expected NonDemented risk score 0, got {score_non}"
    assert risk_category(score_non) == "Low", f"Expected Low, got {risk_category(score_non)}"

    # 100% VeryMildDemented (index 3) -> Risk Score 35 (Moderate)
    probs_vm = np.array([0.0, 0.0, 0.0, 1.0], dtype=np.float32)
    score_vm = calculate_risk_score(probs_vm, classes)
    assert score_vm == 35, f"Expected VeryMildDemented risk score 35, got {score_vm}"
    assert risk_category(score_vm) == "Moderate", f"Expected Moderate, got {risk_category(score_vm)}"

    # 100% MildDemented (index 0) -> Risk Score 70 (High)
    probs_mild = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
    score_mild = calculate_risk_score(probs_mild, classes)
    assert score_mild == 70, f"Expected MildDemented risk score 70, got {score_mild}"
    assert risk_category(score_mild) == "High", f"Expected High, got {risk_category(score_mild)}"

    # 100% ModerateDemented (index 1) -> Risk Score 100 (Critical)
    probs_mod = np.array([0.0, 1.0, 0.0, 0.0], dtype=np.float32)
    score_mod = calculate_risk_score(probs_mod, classes)
    assert score_mod == 100, f"Expected ModerateDemented risk score 100, got {score_mod}"
    assert risk_category(score_mod) == "Critical", f"Expected Critical, got {risk_category(score_mod)}"

    print("  [PASS] Risk score weighted calculations and categories verified")


def test_empirical_forward_pass_on_known_slices():
    """Verify that dementia_model.keras output neurons activate as expected on real test slices."""
    print("\n[TEST 6] Running empirical forward pass on ground-truth test slices...")
    config = TrainingConfig()
    model = load_trained_model(config.model_path)
    test_dir = Path("dataset/test")

    if not test_dir.exists():
        print("  [WARN] Skipping forward pass test: dataset/test/ not found")
        return

    expected_indices = {
        "MildDemented": 0,
        "ModerateDemented": 1,
        "NonDemented": 2,
        "VeryMildDemented": 3,
    }

    for class_name, expected_neuron in expected_indices.items():
        folder = test_dir / class_name
        images = list(folder.glob("*.jpg")) + list(folder.glob("*.png"))
        assert len(images) > 0, f"No test images found in {folder}"

        sample = images[:5]
        predictions = []
        for img_path in sample:
            with Image.open(img_path) as img:
                arr = np.asarray(img.convert("RGB").resize((224, 224), Image.Resampling.BILINEAR), dtype=np.float32)
                pred = model.predict(np.expand_dims(arr, axis=0), verbose=0)[0]
                predictions.append(pred)

        avg_pred = np.mean(predictions, axis=0)
        top_idx = int(np.argmax(avg_pred))
        print(f"  Class '{class_name}': expected neuron {expected_neuron}, top firing neuron = {top_idx} (avg prob: {avg_pred[top_idx]:.4f})")
        assert top_idx == expected_neuron, (
            f"Class mapping mismatch on ground-truth '{class_name}': "
            f"expected neuron {expected_neuron}, but highest activating neuron was {top_idx}"
        )

    print("  [PASS] Empirical forward pass confirmed on all 4 classes")


def main():
    print("=" * 70)
    print("NEUROSCAN AI: CLASS MAPPING AUTOMATED TEST SUITE")
    print("=" * 70)

    try:
        test_classes_py_definition()
        test_dataset_validator_expected_classes()
        test_saved_class_mapping_json_format()
        test_inference_class_loader()
        test_risk_score_calculation()
        test_empirical_forward_pass_on_known_slices()

        print("\n" + "=" * 70)
        print("ALL TESTS PASSED SUCCESSFULLY (6/6)")
        print("=" * 70)
        return 0
    except AssertionError as exc:
        print(f"\n[FAIL] TEST FAILED: {exc}")
        return 1
    except Exception as exc:
        print(f"\n[ERROR] UNEXPECTED ERROR: {exc}")
        import traceback
        traceback.print_exc()
        return 2
        import traceback
        traceback.print_exc()
        return 2


if __name__ == "__main__":
    sys.exit(main())
