import socket
# Custom getaddrinfo monkey patch bypassed because system DNS works correctly and hardcoded IPs caused timeouts.
_original_getaddrinfo = socket.getaddrinfo
def _custom_getaddrinfo(host, port, *args, **kwargs):
    return _original_getaddrinfo(host, port, *args, **kwargs)
socket.getaddrinfo = _custom_getaddrinfo

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
    """Manage application lifecycle."""
    # Startup
    print("CORS ENABLED")
    print("Allowed Origins:", ALLOWED_ORIGINS)

    logger.info("Validating Supabase configuration...")
    try:
        validate_supabase_startup()
        logger.info("Supabase configuration validated successfully")
    except Exception as e:
        logger.warning(f"Supabase startup validation skipped/failed: {e}. Proceeding with local fallback mode.")

    logger.info("Initializing database...")
    SupabaseDB.initialize()
    await create_tables()
    logger.info("Database initialized successfully")

    logger.info("Ensuring MRI prediction model artifact is available...")
    from .ai.model_sync import ensure_model_available
    ensure_model_available()

    logger.info("Loading MRI prediction model...")
    load_model_once()
    logger.info("MRI prediction model loaded successfully")

    try:
        logger.info("Initializing store...")
        initialize_store()
        logger.info("Store initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize store: {e}")

    try:
        from .services.jemmi.knowledge_service import KnowledgeService
        logger.info("Initializing offline RAG database...")
        KnowledgeService.init_rag_db()
        logger.info("Offline RAG database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize RAG database: {e}")

    yield

    # Shutdown
    try:
        logger.info("Closing database connections...")
        SupabaseDB.close_all()
        logger.info("Database connections closed")
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
