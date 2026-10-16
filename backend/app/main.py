import os
import sys
from datetime import datetime, timezone

# 1. Enforce CPU-only and single-threaded execution BEFORE any C++ libraries load
os.environ.setdefault('CUDA_VISIBLE_DEVICES', '-1')
os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '2')
os.environ.setdefault('TF_ENABLE_ONEDNN_OPTS', '0')
os.environ.setdefault('OMP_NUM_THREADS', '1')
os.environ.setdefault('TF_NUM_INTRAOP_THREADS', '1')
os.environ.setdefault('TF_NUM_INTEROP_THREADS', '1')

def _startup_diag(stage: str, detail: str = "") -> None:
    """Print safe, timestamped diagnostic output flushed immediately to stdout for crash tracing."""
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    rss_info = ""
    try:
        import psutil
        rss_mb = psutil.Process().memory_info().rss / (1024 * 1024)
        rss_info = f" [RSS: {rss_mb:.1f} MiB]"
    except Exception:
        pass
    msg = f"[STARTUP-DIAG] {now_str} UTC{rss_info} -> {stage}"
    if detail:
        msg += f" | {detail}"
    print(msg, flush=True)

_startup_diag("main_module_loaded", "CPU-only environment variables pre-configured")

# Initialize low-memory CPU-only TensorFlow runtime configuration
from .ai.config import configure_tensorflow_runtime
configure_tensorflow_runtime()
_startup_diag("tensorflow_runtime_configured")

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .core.database import SupabaseDB, create_tables
from .api import analysis as prediction_analysis
from .api import explainability
from .api import health
from .ai.inference import load_model_once
from .services.supabase_store import initialize_store
from .services.supabase_verification import validate_supabase_startup
from .routers import admin, analysis, assistant, auth, dashboard, mri, profile, reports, users, settings as settings_router, notes

logger = logging.getLogger(__name__)
settings = get_settings()
ALLOWED_ORIGINS = settings.cors_origins


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle with granular crash tracing."""
    _startup_diag("lifespan_enter", "Uvicorn startup initiated")
    print("CORS ENABLED", flush=True)
    print("Allowed Origins:", ALLOWED_ORIGINS, flush=True)

    _startup_diag("supabase_validation_start")
    try:
        validate_supabase_startup()
        _startup_diag("supabase_validation_complete", "Validated successfully")
    except Exception as e:
        logger.warning(f"Supabase startup validation skipped/failed: {e}. Proceeding with local fallback mode.")
        _startup_diag("supabase_validation_fallback", f"Warning: {e}")
    except BaseException as be:
        _startup_diag("supabase_validation_fatal_error", f"Fatal: {type(be).__name__}: {be}")
        raise

    _startup_diag("database_init_start")
    SupabaseDB.initialize()
    await create_tables()
    _startup_diag("database_init_complete", "Tables verified")

    _startup_diag("model_artifact_sync_start", "Checking if dementia_model.keras exists locally")
    from .ai.model_sync import ensure_model_available
    ensure_model_available()
    _startup_diag("model_artifact_sync_complete", "Model file verified on disk")

    _startup_diag("model_singleton_load_start", "Calling load_model_once() without eager warmup")
    try:
        load_model_once()
        _startup_diag("model_singleton_load_complete", "Model structure and weights loaded into memory")
    except Exception as e:
        _startup_diag("model_singleton_load_error", str(e))
        raise

    try:
        _startup_diag("store_init_start")
        initialize_store()
        _startup_diag("store_init_complete")
    except Exception as e:
        logger.error(f"Failed to initialize store: {e}")
        _startup_diag("store_init_error", str(e))

    try:
        _startup_diag("offline_rag_init_start")
        from .services.jemmi.knowledge_service import KnowledgeService
        KnowledgeService.init_rag_db()
        _startup_diag("offline_rag_init_complete")
    except Exception as e:
        logger.error(f"Failed to initialize RAG database: {e}")
        _startup_diag("offline_rag_init_error", str(e))

    _startup_diag("lifespan_ready", "Application successfully initialized; ready to receive requests")

    yield

    _startup_diag("shutdown_enter")
    try:
        SupabaseDB.close_all()
        _startup_diag("shutdown_complete", "Database connections closed")
    except Exception as e:
        logger.error(f"Error closing database: {e}")


from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
import psycopg2

app = FastAPI(title=settings.app_name, lifespan=lifespan)

# Mount mock storage directory to serve local MRI images/heatmaps/reports
from fastapi.staticfiles import StaticFiles
mock_storage_dir = settings.mock_storage_dir
mock_storage_dir.mkdir(parents=True, exist_ok=True)
app.mount("/mock_storage", StaticFiles(directory=str(mock_storage_dir)), name="mock_storage")

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(psycopg2.OperationalError)
async def db_operational_error_handler(request, exc):
    logger.error(f"Database operational error: {exc}")
    return JSONResponse(
        status_code=503,
        content={"detail": "Database connection is temporarily unavailable. Please try again shortly."},
    )

@app.exception_handler(psycopg2.InterfaceError)
async def db_interface_error_handler(request, exc):
    logger.error(f"Database interface error: {exc}")
    return JSONResponse(
        status_code=503,
        content={"detail": "Database connection interface error. Please try again shortly."},
    )

app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(admin.router, prefix=settings.api_v1_prefix)
app.include_router(analysis.router, prefix=settings.api_v1_prefix)
app.include_router(assistant.router, prefix=settings.api_v1_prefix)
app.include_router(dashboard.router, prefix=settings.api_v1_prefix)
app.include_router(mri.router, prefix=settings.api_v1_prefix)
app.include_router(profile.router, prefix=settings.api_v1_prefix)
app.include_router(reports.router, prefix=settings.api_v1_prefix)
app.include_router(users.router, prefix=settings.api_v1_prefix)
app.include_router(settings_router.router, prefix=settings.api_v1_prefix)
app.include_router(notes.router, prefix=settings.api_v1_prefix)
app.include_router(health.router)
app.include_router(prediction_analysis.router)
app.include_router(prediction_analysis.router, prefix=settings.api_v1_prefix)
app.include_router(explainability.router)
app.include_router(explainability.router, prefix=settings.api_v1_prefix)


@app.get('/')
def root():
    return {'name': settings.app_name, 'status': 'ok'}


@app.get('/cors-test')
async def cors_test():
    return {'cors': 'ok'}
# Trigger reload
