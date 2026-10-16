"""
Model Artifact Synchronization Module for NeuroScan AI.

Ensures that the trained model weights ('dementia_model.keras') are available locally
on the application server (e.g., Render container or local environment).
If missing or invalid, it downloads the model artifact securely from the private
Supabase Storage 'models' bucket using server-side credentials.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
import sys

from ..core.config import get_settings
from .config import TrainingConfig

logger = logging.getLogger(__name__)

# Minimum valid size threshold for dementia_model.keras (approx 35.66 MB)
MIN_MODEL_SIZE_BYTES = 35 * 1024 * 1024


def is_valid_model_file(path: Path) -> bool:
    """Check if the model file exists, meets minimum size, and has a valid file header."""
    if not path.is_file():
        return False

    try:
        size = path.stat().st_size
        if size < MIN_MODEL_SIZE_BYTES:
            logger.warning(
                f"Model file {path} exists but is too small ({size} bytes < {MIN_MODEL_SIZE_BYTES} bytes)"
            )
            return False

        with open(path, "rb") as f:
            header = f.read(8)

        # Keras v3 (.keras) is a zip archive starting with PK\x03\x04; H5 starts with \x89HDF
        if header.startswith(b"PK\x03\x04") or header.startswith(b"\x89HDF"):
            return True

        logger.warning(f"Model file {path} has invalid file header: {header!r}")
        return False
    except Exception as e:
        logger.warning(f"Error checking model file {path}: {e}")
        return False


def ensure_model_available(force_download: bool = False) -> Path:
    """
    Ensure the trained model file exists and is valid.
    Downloads from Supabase private storage if missing or invalid.
    Returns the Path to the verified model file.
    """
    config = TrainingConfig()
    model_path = config.model_path

    if not force_download and is_valid_model_file(model_path):
        size_mb = model_path.stat().st_size / (1024 * 1024)
        logger.info(f"Trained model artifact verified ({size_mb:.2f} MB): {model_path}")
        return model_path

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise RuntimeError(
            "Cannot download model artifact: SUPABASE_URL or SUPABASE_KEY is missing from environment."
        )

    bucket = settings.supabase_model_bucket or "models"
    model_filename = model_path.name

    logger.info(
        f"Downloading model artifact '{model_filename}' from private Supabase bucket '{bucket}'..."
    )

    # Lazy import to avoid importing supabase when model is already present
    from supabase import create_client

    client = create_client(settings.supabase_url, settings.supabase_key)
    download_bytes = client.storage.from_(bucket).download(model_filename)

    if not download_bytes or len(download_bytes) < MIN_MODEL_SIZE_BYTES:
        raise RuntimeError(
            f"Downloaded model artifact is incomplete ({len(download_bytes) if download_bytes else 0} bytes). "
            f"Expected at least {MIN_MODEL_SIZE_BYTES} bytes."
        )

    # Validate header
    header = download_bytes[:8]
    if not (header.startswith(b"PK\x03\x04") or header.startswith(b"\x89HDF")):
        raise RuntimeError(
            f"Downloaded file from bucket '{bucket}' does not have a valid Keras/HDF5 archive header: {header!r}"
        )

    # Ensure parent directory exists
    model_path.parent.mkdir(parents=True, exist_ok=True)

    # Atomic write via temporary file
    temp_path = model_path.with_suffix(".tmp")
    try:
        with open(temp_path, "wb") as f:
            f.write(download_bytes)
        del download_bytes
        import gc
        gc.collect()

        # Verify written temp file
        if not is_valid_model_file(temp_path):
            raise RuntimeError("Temporary model file failed validation after download.")

        temp_path.replace(model_path)
    finally:
        if 'download_bytes' in locals():
            del download_bytes
        if temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass

    size_mb = model_path.stat().st_size / (1024 * 1024)
    logger.info(
        f"Model artifact successfully downloaded and verified ({size_mb:.2f} MB) at: {model_path}"
    )
    return model_path


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    try:
        path = ensure_model_available()
        print(f"Model ready at: {path}")
        sys.exit(0)
    except Exception as exc:
        print(f"Model sync failed: {exc}", file=sys.stderr)
        sys.exit(1)
