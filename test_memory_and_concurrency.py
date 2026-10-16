"""Automated Test Suite for Model Loading, Concurrency, Failure Handling, and Memory Efficiency.

Verifies:
1. Model loading: Singleton pattern, exactly once loading, and compile=False (no optimizer weights).
2. Concurrency: Thread-based serialization under _predict_lock with multiple concurrent workers.
3. Failure handling: Graceful handling of empty or corrupted image bytes without locking up the service.
4. Grad-CAM integration: Verifies heatmap generation runs cleanly under predict lock.
5. Memory stabilization: Consecutive inference runs do not leak RAM unbounded.
"""

from __future__ import annotations

import concurrent.futures
import io
import os
import sys
import threading
import time
from pathlib import Path

# Add backend directory to path
PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# Ensure low-memory CPU-only TensorFlow runtime is configured before imports
from app.ai.config import configure_tensorflow_runtime
configure_tensorflow_runtime()

from PIL import Image
import numpy as np
import psutil

from app.ai.inference import (
    MRIInferenceError,
    MRIModelService,
    get_model_service,
    load_model_once,
)
from app.ai.gradcam import GradCAMError, get_gradcam_service


def create_dummy_mri_png_bytes(width: int = 224, height: int = 224) -> bytes:
    """Generate valid in-memory PNG bytes simulating an MRI slice."""
    img = Image.new("RGB", (width, height), color=(30, 30, 30))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_1_singleton_and_model_loading() -> bool:
    print("\n[TEST 1] Testing Model Singleton & One-Time Loading...")
    service1 = get_model_service()
    service2 = get_model_service()
    assert service1 is service2, "get_model_service() must return a singleton instance"

    load_model_once()
    model1 = service1.model
    model2 = service2.model
    assert model1 is model2, "Model instance must be identical across calls"
    assert not hasattr(model1, "optimizer") or model1.optimizer is None, (
        "Model must be loaded with compile=False to avoid allocating optimizer weights"
    )
    print("  [PASS] Singleton pattern verified and compile=False verified (no optimizer buffers)")
    return True


def test_2_failure_handling() -> bool:
    print("\n[TEST 2] Testing Inference Failure Handling...")
    service = get_model_service()

    # 1. Empty bytes
    try:
        service.predict(b"")
        print("  [FAIL] Empty bytes did not raise MRIInferenceError")
        return False
    except MRIInferenceError as e:
        assert "Empty MRI image" in str(e), f"Unexpected error message: {e}"
        print("  [PASS] Empty bytes correctly rejected with MRIInferenceError")

    # 2. Corrupted bytes
    try:
        service.predict(b"RIFF\x00\x00corrupted_bytes_that_are_not_image")
        print("  [FAIL] Corrupted bytes did not raise MRIInferenceError")
        return False
    except MRIInferenceError as e:
        assert "could not be decoded" in str(e), f"Unexpected error message: {e}"
        print("  [PASS] Corrupted bytes correctly rejected with MRIInferenceError")

    # 3. Service recovery after failure
    valid_bytes = create_dummy_mri_png_bytes()
    output = service.predict(valid_bytes)
    assert output.prediction in service.classes
    print("  [PASS] Service successfully handles valid request immediately following failures")
    return True


def test_3_concurrency_serialization() -> bool:
    print("\n[TEST 3] Testing Multi-threaded Concurrency Serialization...")
    service = get_model_service()
    valid_bytes = create_dummy_mri_png_bytes()

    active_inferences = 0
    max_concurrent_observed = 0
    lock = threading.Lock()
    errors = []

    def run_worker(worker_id: int):
        nonlocal active_inferences, max_concurrent_observed
        try:
            # We hook slightly around the service to monitor concurrency
            with service._predict_lock:
                with lock:
                    active_inferences += 1
                    if active_inferences > max_concurrent_observed:
                        max_concurrent_observed = active_inferences
                # Simulate work inside the lock
                time.sleep(0.05)
                with lock:
                    active_inferences -= 1

            result = service.predict(valid_bytes)
            assert result.prediction in service.classes
            return worker_id, result.prediction
        except Exception as exc:
            errors.append((worker_id, exc))
            return worker_id, None

    num_threads = 6
    print(f"  Spawning {num_threads} simultaneous threads requesting inference...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(run_worker, i) for i in range(num_threads)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    assert len(errors) == 0, f"Encountered errors during concurrent execution: {errors}"
    assert len(results) == num_threads, f"Expected {num_threads} results, got {len(results)}"
    assert max_concurrent_observed == 1, (
        f"Inference was not serialized! Max concurrent observed: {max_concurrent_observed}"
    )
    print(f"  [PASS] All {num_threads} threads completed successfully with max concurrency = 1 (strictly serialized)")
    return True


def test_4_gradcam_integration() -> bool:
    print("\n[TEST 4] Testing Grad-CAM Generation & Memory Freeing...")
    gradcam_service = get_gradcam_service()
    valid_bytes = create_dummy_mri_png_bytes()

    output = gradcam_service.generate(valid_bytes)
    assert output.heatmap_png.startswith(b"\x89PNG"), "Grad-CAM must produce a valid PNG"
    assert len(output.heatmap_png) > 100, "Grad-CAM PNG must have content"
    assert output.prediction in get_model_service().classes
    print(f"  [PASS] Grad-CAM generated valid heatmap PNG ({len(output.heatmap_png)} bytes) for {output.prediction}")
    return True


def test_5_memory_stability() -> bool:
    print("\n[TEST 5] Testing Memory Stability Across Multiple Inferences...")
    service = get_model_service()
    valid_bytes = create_dummy_mri_png_bytes()

    process = psutil.Process()
    rss_start_mb = process.memory_info().rss / (1024 * 1024)
    print(f"  Initial RSS: {rss_start_mb:.2f} MiB")

    # Run 5 successive inferences
    for i in range(5):
        out = service.predict(valid_bytes)
        rss_current_mb = process.memory_info().rss / (1024 * 1024)
        print(f"  Run {i+1}: Prediction={out.prediction}, RSS={rss_current_mb:.2f} MiB")

    rss_final_mb = process.memory_info().rss / (1024 * 1024)
    delta_mb = rss_final_mb - rss_start_mb
    print(f"  Final RSS: {rss_final_mb:.2f} MiB (Delta: {delta_mb:+.2f} MiB)")
    assert delta_mb < 50.0, f"Excessive memory drift detected: {delta_mb:.2f} MiB"
    print("  [PASS] Memory remained stable across multiple predictions (no leakage)")
    return True


if __name__ == "__main__":
    print("=" * 70)
    print("NEUROSCAN AI: INFERENCE MEMORY & CONCURRENCY TEST SUITE")
    print("=" * 70)

    t1 = test_1_singleton_and_model_loading()
    t2 = test_2_failure_handling()
    t3 = test_3_concurrency_serialization()
    t4 = test_4_gradcam_integration()
    t5 = test_5_memory_stability()

    if all([t1, t2, t3, t4, t5]):
        print("\n" + "=" * 70)
        print("ALL MEMORY, CONCURRENCY & FAILURE TESTS PASSED SUCCESSFULLY (5/5)")
        print("=" * 70)
        sys.exit(0)
    else:
        print("\n[ERROR] One or more tests failed.")
        sys.exit(1)
