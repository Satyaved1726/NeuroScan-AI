"""Supabase PostgreSQL database initialization and management."""

import sys
from typing import Optional
import logging
import sqlite3
import queue
import uuid
import json
from datetime import datetime, timezone

try:
    import psycopg2
    from psycopg2 import InterfaceError, OperationalError
    from psycopg2 import sql
    from psycopg2 import extensions
    from psycopg2.extras import RealDictCursor
    from psycopg2.pool import ThreadedConnectionPool
except ImportError:
    psycopg2 = None
    extensions = None

from .config import get_settings

logger = logging.getLogger(__name__)

# --- Mock Supabase Storage Client and local storage helpers ---

class MockStorageBucket:
    def __init__(self, bucket_name):
        self.bucket_name = bucket_name

    def upload(self, path, content, file_options=None):
        settings = get_settings()
        dest = settings.mock_storage_dir / self.bucket_name / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)
        return {"path": path}

    def get_public_url(self, path):
        return f"http://localhost:8000/mock_storage/{self.bucket_name}/{path}"

    def download(self, path):
        settings = get_settings()
        src = settings.mock_storage_dir / self.bucket_name / path
        if src.exists():
            return src.read_bytes()
        if path.endswith(".pdf"):
            return b"%PDF-1.4 mock pdf content"
        return b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"

class MockStorageClient:
    def __init__(self):
        pass

    def from_(self, bucket_name):
        return MockStorageBucket(bucket_name)

    def list_buckets(self):
        class MockBucketItem:
            def __init__(self, name):
                self.name = name
                self.id = name
            def model_dump(self):
                return {"name": self.name, "id": self.id}
            def dict(self):
                return {"name": self.name, "id": self.id}
        return [MockBucketItem("mri-images"), MockBucketItem("heatmaps"), MockBucketItem("reports")]

class MockSupabaseClient:
    def __init__(self):
        self.storage = MockStorageClient()

def get_mock_supabase_client(url, key, *args, **kwargs):
    return MockSupabaseClient()

# --- Mock SQLite adapter mimicking psycopg2 interface ---

class SQLiteConnection:
    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.create_function("gen_random_uuid", 0, lambda: str(uuid.uuid4()))
        self.conn.create_function("now", 0, lambda: datetime.now(timezone.utc).isoformat())
        self.conn.create_function("strpos", 2, lambda s, sub: (s.find(sub) + 1) if s and sub else 0)
        self.closed = False

    def cursor(self, cursor_factory=None):
        return SQLiteCursor(self.conn.cursor(), cursor_factory)

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()
        self.closed = True

    def get_transaction_status(self):
        return 1

    @property
    def status(self):
        if psycopg2 and extensions:
            return extensions.STATUS_READY
        return 0

class SQLiteCursor:
    def __init__(self, cursor, factory=None):
        self.cursor = cursor
        self.factory = factory
        self.description = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def execute(self, sql, params=None):
        sql_translated = sql.replace('%s', '?')

        new_params = []
        if params:
            for p in params:
                # Handle psycopg2 Extras Json or regular dictionary parameters
                if hasattr(p, 'adapted') or isinstance(p, (dict, list)):
                    new_params.append(json.dumps(getattr(p, 'adapted', p)))
                else:
                    new_params.append(p)
            params = tuple(new_params)

        try:
            if params is not None:
                self.cursor.execute(sql_translated, params)
            else:
                self.cursor.execute(sql_translated)
            self.description = self.cursor.description
        except Exception as e:
            logger.error(f"SQLite execute error: {e}\nSQL: {sql_translated}\nParams: {params}")
            raise

    def fetchone(self):
        row = self.cursor.fetchone()
        if row is None:
            return None
        return SQLiteRow(row, self.factory)

    def fetchall(self):
        rows = self.cursor.fetchall()
        return [SQLiteRow(row, self.factory) for row in rows]

    def close(self):
        self.cursor.close()

class SQLiteRow(dict):
    def __init__(self, row, factory):
        d = {}
        for k in row.keys():
            val = row[k]
            if isinstance(val, str) and (val.startswith('{') or val.startswith('[')):
                try:
                    val = json.loads(val)
                except Exception:
                    pass
            d[k] = val
        super().__init__(d)
        self.row = row

    def __getitem__(self, key):
        if isinstance(key, int):
            return self.row[key]
        return super().__getitem__(key)

class SQLiteConnectionPool:
    def __init__(self, db_path):
        self.db_path = db_path
        self._connections = queue.Queue()

    def getconn(self):
        try:
            return self._connections.get_nowait()
        except queue.Empty:
            return SQLiteConnection(self.db_path)

    def putconn(self, conn, close=False):
        if close:
            conn.close()
        else:
            self._connections.put(conn)

    def closeall(self):
        while not self._connections.empty():
            conn = self._connections.get()
            conn.close()

def create_sqlite_tables(conn):
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'User',
            full_name TEXT,
            created_at TEXT DEFAULT (now()),
            updated_at TEXT DEFAULT (now()),
            join_date TEXT DEFAULT (now()),
            total_scans INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            access_token_version INTEGER DEFAULT 0,
            access_tokens_invalid_before TEXT,
            instance_id TEXT
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patient_profiles (
            id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
            user_id TEXT UNIQUE NOT NULL,
            patient_id TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            gender TEXT,
            dob TEXT,
            age INTEGER,
            phone TEXT,
            email TEXT,
            blood_group TEXT,
            height REAL,
            weight REAL,
            allergies TEXT,
            medications TEXT,
            medical_history TEXT,
            family_history TEXT,
            emergency_contact_name TEXT,
            emergency_contact_phone TEXT,
            photo_url TEXT,
            photo_storage_path TEXT,
            created_at TEXT DEFAULT (now()),
            updated_at TEXT DEFAULT (now())
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
            user_id TEXT NOT NULL,
            token_id TEXT NOT NULL UNIQUE,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            revoked INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (now())
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
            user_id TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            storage_bucket TEXT NOT NULL,
            storage_path TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            validation TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'uploaded',
            created_at TEXT DEFAULT (now()),
            image_url TEXT
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analysis_history (
            id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
            user_id TEXT NOT NULL,
            scan_id TEXT NOT NULL,
            prediction TEXT NOT NULL,
            confidence REAL NOT NULL,
            risk_score INTEGER NOT NULL,
            risk_category TEXT NOT NULL,
            probabilities TEXT NOT NULL,
            explanation TEXT,
            recommendations TEXT,
            report_id TEXT NOT NULL,
            created_at TEXT DEFAULT (now())
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analysis_results (
            id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
            scan_id TEXT UNIQUE NOT NULL,
            user_id TEXT NOT NULL,
            prediction TEXT NOT NULL,
            confidence REAL NOT NULL,
            risk_score INTEGER NOT NULL,
            risk_category TEXT NOT NULL,
            probabilities TEXT NOT NULL,
            model_name TEXT NOT NULL,
            model_accuracy REAL,
            created_at TEXT DEFAULT (now()),
            summary TEXT,
            heatmap_url TEXT,
            heatmap_storage_bucket TEXT,
            heatmap_storage_path TEXT,
            heatmap_generated_at TEXT
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
            user_id TEXT,
            scan_id TEXT NOT NULL,
            report_url TEXT,
            storage_bucket TEXT,
            storage_path TEXT,
            status TEXT NOT NULL DEFAULT 'generated',
            created_at TEXT DEFAULT (now()),
            updated_at TEXT DEFAULT (now())
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
            user_id TEXT NOT NULL,
            scan_id TEXT,
            patient_id TEXT,
            question TEXT,
            answer TEXT,
            message TEXT,
            response TEXT,
            session_id TEXT,
            language TEXT DEFAULT 'English',
            response_time REAL,
            model TEXT,
            tokens_used INTEGER,
            feedback INTEGER,
            created_at TEXT DEFAULT (now())
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            scan_id TEXT,
            patient_id TEXT,
            is_archived INTEGER DEFAULT 0,
            is_favorite INTEGER DEFAULT 0,
            language TEXT DEFAULT 'English',
            created_at TEXT DEFAULT (now()),
            updated_at TEXT DEFAULT (now())
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
            user_id TEXT,
            action TEXT,
            resource_type TEXT,
            resource_id TEXT,
            metadata TEXT,
            created_at TEXT DEFAULT (now())
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_settings (
            id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
            user_id TEXT UNIQUE NOT NULL,
            theme TEXT DEFAULT 'light',
            language TEXT DEFAULT 'en',
            assistant_language TEXT DEFAULT 'en',
            voice_enabled INTEGER DEFAULT 1,
            speech_rate REAL DEFAULT 1.0,
            notifications INTEGER DEFAULT 1,
            email_notifications INTEGER DEFAULT 1,
            push_notifications INTEGER DEFAULT 1,
            high_contrast INTEGER DEFAULT 0,
            font_size TEXT DEFAULT 'medium',
            created_at TEXT DEFAULT (now()),
            updated_at TEXT DEFAULT (now())
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS doctor_notes (
            id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
            scan_id TEXT NOT NULL,
            doctor_id TEXT NOT NULL,
            title TEXT NOT NULL,
            note TEXT NOT NULL,
            severity TEXT DEFAULT 'Low',
            created_at TEXT DEFAULT (now()),
            updated_at TEXT DEFAULT (now())
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS appointments (
            id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
            patient_id TEXT NOT NULL,
            doctor_id TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT DEFAULT 'Scheduled',
            reason TEXT,
            created_at TEXT DEFAULT (now()),
            updated_at TEXT DEFAULT (now())
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS prescriptions (
            id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
            patient_id TEXT NOT NULL,
            doctor_id TEXT NOT NULL,
            medicine TEXT NOT NULL,
            dosage TEXT NOT NULL,
            duration TEXT NOT NULL,
            instructions TEXT,
            created_at TEXT DEFAULT (now()),
            updated_at TEXT DEFAULT (now())
        );
    """)
    conn.commit()


class SupabaseDB:
    """Supabase PostgreSQL database connection management."""

    _instance: Optional['SupabaseDB'] = None
    _pool: Optional[ThreadedConnectionPool] = None
    is_mock: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def initialize(cls) -> 'SupabaseDB':
        """Initialize database connection pool."""
        if cls._instance is None:
            cls._instance = cls()

        if cls._pool is not None:
            return cls._instance

        settings = get_settings()
        db_url = settings.supabase_db_url
        if not db_url:
            raise RuntimeError("SUPABASE_DB_URL is not configured!")

        import time
        max_attempts = 2
        for attempt in range(max_attempts):
            try:
                cls._pool = ThreadedConnectionPool(
                    1, 20,
                    db_url,
                    connect_timeout=4,
                    keepalives=1,
                    keepalives_idle=30,
                    keepalives_interval=10,
                    keepalives_count=5,
                    application_name=settings.app_name,
                )
                logger.info("Database connection pool initialized successfully")
                return cls._instance
            except Exception as e:
                if attempt == max_attempts - 1:
                    logger.warning(f"Failed to connect to Supabase PostgreSQL ({e}). Falling back to local SQLite database...")
                    data_dir = settings.data_dir
                    data_dir.mkdir(parents=True, exist_ok=True)
                    cls._pool = SQLiteConnectionPool(str(data_dir / "local_neuroscan.db"))
                    cls.is_mock = True
                    logger.info("Local SQLite connection pool initialized successfully")
                    return cls._instance
                logger.warning(f"Database pool init attempt {attempt + 1} failed: {e}. Retrying in 1 second...")
                time.sleep(1)

        return cls._instance

    @classmethod
    def get_connection(cls):
        """Get a connection from the pool."""
        if cls._pool is None:
            cls.initialize()

        if cls._pool is None:
            raise RuntimeError("Database connection pool is not initialized")

        last_error: Exception | None = None
        for attempt in range(3):
            try:
                conn = cls._pool.getconn()
                if conn.closed:
                    raise InterfaceError("Pooled database connection is already closed")
                if conn.status == extensions.STATUS_IN_TRANSACTION:
                    conn.rollback()
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    cursor.fetchone()
                return conn
            except (OperationalError, InterfaceError) as exc:
                last_error = exc
                logger.warning(
                    "Discarding unhealthy database connection from pool (attempt %s): %s",
                    attempt + 1,
                    exc,
                )
                try:
                    cls._pool.putconn(conn, close=True)
                except Exception:
                    logger.exception("Failed to discard unhealthy database connection")
            except Exception as exc:
                if 'conn' in locals():
                    cls._pool.putconn(conn)
                last_error = exc
                logger.warning(f"Unexpected error when checking postgres connection: {exc}")

        raise RuntimeError(f"PostgreSQL connection failed: {last_error}")

    @classmethod
    def return_connection(cls, conn, *, close: bool = False):
        """Return a connection to the pool."""
        if cls._pool is not None and conn is not None:
            # Check if there is an active DB exception in sys.exc_info()
            exc_type = sys.exc_info()[0]
            is_unhealthy = (
                close
                or (exc_type is not None and issubclass(exc_type, (OperationalError, InterfaceError)))
                or getattr(conn, "closed", True)
                or conn.get_transaction_status() == extensions.TRANSACTION_STATUS_UNKNOWN
            )
            try:
                cls._pool.putconn(conn, close=is_unhealthy)
            except Exception as e:
                logger.error(f"Failed to return connection to pool: {e}")

    @classmethod
    def close_all(cls):
        """Close all connections in the pool."""
        if cls._pool is not None:
            cls._pool.closeall()
            cls._pool = None
            logger.info("Database connection pool closed")


async def create_tables():
    """Create necessary database tables."""
    if getattr(SupabaseDB, "is_mock", False):
        logger.info("Local SQLite database mode detected. Initializing SQLite tables...")
        db = SupabaseDB.initialize()
        conn = db.get_connection()
        try:
            create_sqlite_tables(conn)
            logger.info("Local SQLite tables initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize SQLite tables: {e}")
            raise
        finally:
            db.return_connection(conn)
        return

    db_url = get_settings().supabase_db_url
    if not db_url:
        logger.warning("SUPABASE_DB_URL not configured. Skipping table creation.")
        return

    import psycopg2
    import time
    max_attempts = 5
    conn = None
    for attempt in range(max_attempts):
        try:
            conn = psycopg2.connect(db_url, connect_timeout=15)
            break
        except Exception as e:
            if attempt == max_attempts - 1:
                logger.error(f"Failed to connect for table creation after {max_attempts} attempts: {e}")
                raise
            logger.warning(f"Table creation connection attempt {attempt + 1} failed: {e}. Retrying in 2 seconds...")
            time.sleep(2)
    cursor = None

    try:
        cursor = conn.cursor()

        def add_foreign_key(table: str, column: str, referenced_table: str, referenced_column: str, constraint_name: str) -> None:
            cursor.execute(
                sql.SQL(
                    """
                    DO $$
                    DECLARE
                        existing_constraint RECORD;
                    BEGIN
                        FOR existing_constraint IN
                            SELECT con.conname
                            FROM pg_constraint con
                            JOIN pg_attribute att
                                ON att.attrelid = con.conrelid
                                AND att.attnum = ANY(con.conkey)
                            WHERE con.contype = 'f'
                                AND con.conrelid = {}::regclass
                                AND con.confrelid = {}::regclass
                                AND att.attname = {}
                        LOOP
                            EXECUTE format('ALTER TABLE {} DROP CONSTRAINT %I', existing_constraint.conname);
                        END LOOP;
                    END $$;
                    """
                ).format(
                    sql.Literal(table),
                    sql.Literal(referenced_table),
                    sql.Literal(column),
                    sql.Identifier(table),
                )
            )

            cursor.execute(
                sql.SQL(
                    "ALTER TABLE {} ADD CONSTRAINT {} FOREIGN KEY ({}) REFERENCES {}({}) ON DELETE CASCADE"
                ).format(
                    sql.Identifier(table),
                    sql.Identifier(constraint_name),
                    sql.Identifier(column),
                    sql.Identifier(referenced_table),
                    sql.Identifier(referenced_column),
                )
            )

        def normalize_uuid_column(table: str, column: str) -> None:
            cursor.execute(
                f"""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = '{table}'
                            AND column_name = '{column}'
                            AND data_type <> 'uuid'
                    ) THEN
                        EXECUTE 'ALTER TABLE {table} ALTER COLUMN {column} DROP NOT NULL';
                        EXECUTE $sql$
                            UPDATE {table}
                            SET {column} = NULL
                            WHERE {column} IS NOT NULL
                                AND {column}::text !~* '^[0-9a-f]{{8}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{12}}$'
                        $sql$;
                        EXECUTE 'ALTER TABLE {table} ALTER COLUMN {column} TYPE UUID USING {column}::uuid';
                    END IF;
                END $$;
                """
            )

        print("Creating users table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'User',
                full_name VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                join_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                total_scans INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                access_token_version INTEGER DEFAULT 0,
                access_tokens_invalid_before TIMESTAMP WITH TIME ZONE,
                instance_id UUID
            );
        """)

        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS name VARCHAR(255);
        """)

        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
        """)

        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
        """)

        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'User';
        """)

        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS join_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        """)

        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS total_scans INTEGER DEFAULT 0;
        """)

        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
        """)

        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS access_tokens_invalid_before TIMESTAMP WITH TIME ZONE;
        """)

        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS access_token_version INTEGER DEFAULT 0;
        """)

        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        """)

        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        """)

        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS instance_id UUID;
        """)

        cursor.execute("""
            UPDATE users
            SET
                name = COALESCE(name, full_name, email, 'Unknown User'),
                full_name = COALESCE(full_name, name, email, 'Unknown User'),
                role = COALESCE(role, 'User'),
                join_date = COALESCE(join_date, created_at, CURRENT_TIMESTAMP),
                total_scans = COALESCE(total_scans, 0),
                is_active = COALESCE(is_active, TRUE),
                access_token_version = COALESCE(access_token_version, 0),
                created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
                updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
            WHERE
                name IS NULL
                OR full_name IS NULL
                OR role IS NULL
                OR join_date IS NULL
                OR total_scans IS NULL
                OR is_active IS NULL
                OR access_token_version IS NULL
                OR created_at IS NULL
                OR updated_at IS NULL;
        """)

        cursor.execute("""
            UPDATE users
            SET full_name = name
            WHERE full_name IS NULL AND name IS NOT NULL;
        """)

        cursor.execute("""
            ALTER TABLE users
            ALTER COLUMN name SET NOT NULL;
        """)

        # Create index on email for faster lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        """)

        print("Creating patient_profiles table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS patient_profiles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID UNIQUE NOT NULL,
                patient_id VARCHAR(50) UNIQUE NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                gender VARCHAR(50),
                dob DATE,
                age INTEGER,
                phone VARCHAR(50),
                email VARCHAR(255),
                blood_group VARCHAR(20),
                height FLOAT,
                weight FLOAT,
                allergies TEXT,
                medications TEXT,
                medical_history TEXT,
                family_history TEXT,
                emergency_contact_name VARCHAR(255),
                emergency_contact_phone VARCHAR(50),
                photo_url TEXT,
                photo_storage_path VARCHAR(500),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT patient_profiles_age_non_negative CHECK (age IS NULL OR age >= 0)
            );
        """)

        for statement in (
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS user_id UUID;",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS patient_id VARCHAR(50);",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(50);",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS dob DATE;",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS age INTEGER;",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(50);",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS blood_group VARCHAR(20);",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS height FLOAT;",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS weight FLOAT;",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS allergies TEXT;",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS medications TEXT;",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS medical_history TEXT;",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS family_history TEXT;",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS photo_storage_path VARCHAR(500);",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;",
            "ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;",
        ):
            cursor.execute(statement)

        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_profiles_user_id_unique ON patient_profiles(user_id);
        """)

        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_profiles_patient_id_unique ON patient_profiles(patient_id);
        """)

        cursor.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'patient_profiles_age_non_negative'
                        AND conrelid = 'patient_profiles'::regclass
                ) THEN
                    ALTER TABLE patient_profiles
                    ADD CONSTRAINT patient_profiles_age_non_negative CHECK (age IS NULL OR age >= 0);
                END IF;
            END $$;
        """)

        add_foreign_key('patient_profiles', 'user_id', 'users', 'id', 'fk_patient_profiles_user_id')

        print("Creating refresh_tokens table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                token_id VARCHAR(64) NOT NULL UNIQUE,
                token_hash VARCHAR(255) NOT NULL UNIQUE,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                revoked BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cursor.execute("""
            ALTER TABLE refresh_tokens
            ADD COLUMN IF NOT EXISTS user_id UUID;
        """)

        cursor.execute("""
            ALTER TABLE refresh_tokens
            ADD COLUMN IF NOT EXISTS token_id VARCHAR(64);
        """)

        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token_id
            ON refresh_tokens(token_id)
            WHERE token_id IS NOT NULL;
        """)

        # Create index for user_id lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
        """)

        add_foreign_key('refresh_tokens', 'user_id', 'users', 'id', 'fk_refresh_tokens_user_id')

        print("Creating scans table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                original_filename TEXT NOT NULL,
                storage_bucket TEXT NOT NULL,
                storage_path TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size_bytes BIGINT NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                validation JSONB NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cursor.execute("""
            ALTER TABLE scans
            ADD COLUMN IF NOT EXISTS user_id UUID;
        """)

        cursor.execute("""
            ALTER TABLE scans
            ADD COLUMN IF NOT EXISTS image_url TEXT;
        """)

        cursor.execute("""
            ALTER TABLE scans
            ADD COLUMN IF NOT EXISTS original_filename TEXT;
        """)

        cursor.execute("""
            ALTER TABLE scans
            ADD COLUMN IF NOT EXISTS storage_bucket TEXT;
        """)

        cursor.execute("""
            ALTER TABLE scans
            ADD COLUMN IF NOT EXISTS storage_path TEXT;
        """)

        cursor.execute("""
            ALTER TABLE scans
            ADD COLUMN IF NOT EXISTS mime_type TEXT;
        """)

        cursor.execute("""
            ALTER TABLE scans
            ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
        """)

        cursor.execute("""
            ALTER TABLE scans
            ADD COLUMN IF NOT EXISTS width INTEGER;
        """)

        cursor.execute("""
            ALTER TABLE scans
            ADD COLUMN IF NOT EXISTS height INTEGER;
        """)

        cursor.execute("""
            ALTER TABLE scans
            ADD COLUMN IF NOT EXISTS validation JSONB;
        """)

        cursor.execute("""
            UPDATE scans
            SET
                original_filename = COALESCE(original_filename, NULLIF(regexp_replace(COALESCE(image_url, ''), '^.*/', ''), ''), id::text),
                storage_bucket = COALESCE(storage_bucket, 'mri-images'),
                storage_path = COALESCE(storage_path, image_url, id::text),
                mime_type = COALESCE(mime_type, 'image/jpeg'),
                size_bytes = COALESCE(size_bytes, 0),
                width = COALESCE(width, 0),
                height = COALESCE(height, 0),
                validation = COALESCE(validation, '{"legacy": true, "passed": true}'::jsonb)
            WHERE
                original_filename IS NULL
                OR storage_bucket IS NULL
                OR storage_path IS NULL
                OR mime_type IS NULL
                OR size_bytes IS NULL
                OR width IS NULL
                OR height IS NULL
                OR validation IS NULL;
        """)

        cursor.execute("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                        AND table_name = 'scans'
                        AND column_name = 'image_url'
                        AND is_nullable = 'NO'
                ) THEN
                    ALTER TABLE scans ALTER COLUMN image_url DROP NOT NULL;
                END IF;
            END $$;
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
        """)

        add_foreign_key('scans', 'user_id', 'users', 'id', 'fk_scans_user_id')

        print("Creating analysis_history table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS analysis_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                scan_id UUID NOT NULL,
                prediction VARCHAR(100) NOT NULL,
                confidence FLOAT NOT NULL,
                risk_score INTEGER NOT NULL,
                risk_category VARCHAR(50) NOT NULL,
                probabilities JSONB NOT NULL,
                explanation TEXT,
                recommendations JSONB,
                report_id VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cursor.execute("""
            ALTER TABLE analysis_history
            ADD COLUMN IF NOT EXISTS user_id UUID;
        """)

        cursor.execute("""
            ALTER TABLE analysis_history
            ADD COLUMN IF NOT EXISTS scan_id UUID;
        """)

        normalize_uuid_column('analysis_history', 'scan_id')

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_analysis_history_user_id ON analysis_history(user_id);
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_analysis_history_scan_id ON analysis_history(scan_id);
        """)

        add_foreign_key('analysis_history', 'user_id', 'users', 'id', 'fk_analysis_history_user_id')
        add_foreign_key('analysis_history', 'scan_id', 'scans', 'id', 'fk_analysis_history_scan_id')

        print("Creating analysis_results table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS analysis_results (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                scan_id UUID NOT NULL,
                user_id UUID NOT NULL,
                prediction VARCHAR(100) NOT NULL,
                confidence FLOAT NOT NULL,
                risk_score INTEGER NOT NULL,
                risk_category VARCHAR(50) NOT NULL,
                probabilities JSONB NOT NULL,
                model_name VARCHAR(255) NOT NULL,
                model_accuracy FLOAT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(scan_id)
            );
        """)

        cursor.execute("""
            ALTER TABLE analysis_results
            ADD COLUMN IF NOT EXISTS scan_id UUID;
        """)

        cursor.execute("""
            ALTER TABLE analysis_results
            ADD COLUMN IF NOT EXISTS user_id UUID;
        """)

        normalize_uuid_column('analysis_results', 'scan_id')

        cursor.execute("""
            ALTER TABLE analysis_results
            ADD COLUMN IF NOT EXISTS risk_category VARCHAR(50);
        """)

        cursor.execute("""
            ALTER TABLE analysis_results
            ADD COLUMN IF NOT EXISTS probabilities JSONB;
        """)

        cursor.execute("""
            ALTER TABLE analysis_results
            ADD COLUMN IF NOT EXISTS model_name VARCHAR(255);
        """)

        cursor.execute("""
            ALTER TABLE analysis_results
            ADD COLUMN IF NOT EXISTS model_accuracy FLOAT;
        """)

        cursor.execute("""
            ALTER TABLE analysis_results
            ADD COLUMN IF NOT EXISTS summary TEXT;
        """)

        cursor.execute("""
            ALTER TABLE analysis_results
            ADD COLUMN IF NOT EXISTS heatmap_url TEXT;
        """)

        cursor.execute("""
            ALTER TABLE analysis_results
            ADD COLUMN IF NOT EXISTS heatmap_storage_bucket VARCHAR(255);
        """)

        cursor.execute("""
            ALTER TABLE analysis_results
            ADD COLUMN IF NOT EXISTS heatmap_storage_path VARCHAR(1024);
        """)

        cursor.execute("""
            ALTER TABLE analysis_results
            ADD COLUMN IF NOT EXISTS heatmap_generated_at TIMESTAMP WITH TIME ZONE;
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_analysis_results_user_id ON analysis_results(user_id);
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_analysis_results_scan_id ON analysis_results(scan_id);
        """)

        cursor.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'analysis_results_scan_id_key'
                        AND conrelid = 'analysis_results'::regclass
                ) THEN
                    ALTER TABLE analysis_results
                    ADD CONSTRAINT analysis_results_scan_id_key UNIQUE (scan_id);
                END IF;
            END $$;
        """)

        add_foreign_key('analysis_results', 'scan_id', 'scans', 'id', 'fk_analysis_results_scan_id')
        add_foreign_key('analysis_results', 'user_id', 'users', 'id', 'fk_analysis_results_user_id')

        print("Creating reports table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                scan_id UUID NOT NULL,
                report_url TEXT,
                storage_bucket VARCHAR(255),
                storage_path VARCHAR(1024),
                status VARCHAR(50) NOT NULL DEFAULT 'generated',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cursor.execute("""
            ALTER TABLE reports
            ADD COLUMN IF NOT EXISTS user_id UUID;
        """)

        cursor.execute("""
            ALTER TABLE reports
            ADD COLUMN IF NOT EXISTS scan_id UUID;
        """)

        normalize_uuid_column('reports', 'scan_id')

        cursor.execute("""
            ALTER TABLE reports
            ADD COLUMN IF NOT EXISTS report_url TEXT;
        """)

        cursor.execute("""
            ALTER TABLE reports
            ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(255);
        """)

        cursor.execute("""
            ALTER TABLE reports
            ADD COLUMN IF NOT EXISTS storage_path VARCHAR(1024);
        """)

        cursor.execute("""
            ALTER TABLE reports
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'generated';
        """)

        cursor.execute("""
            ALTER TABLE reports
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        """)

        cursor.execute("""
            ALTER TABLE reports
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        """)

        cursor.execute("""
            UPDATE reports
            SET
                report_url = COALESCE(report_url, '/api/v1/reports/' || id::text || '/pdf'),
                storage_bucket = COALESCE(storage_bucket, 'reports'),
                storage_path = COALESCE(storage_path, COALESCE(user_id::text, 'legacy') || '/' || id::text || '.pdf'),
                status = COALESCE(status, 'generated'),
                created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
                updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
            WHERE
                report_url IS NULL
                OR storage_bucket IS NULL
                OR storage_path IS NULL
                OR status IS NULL
                OR created_at IS NULL
                OR updated_at IS NULL;
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_reports_scan_id ON reports(scan_id);
        """)

        add_foreign_key('reports', 'user_id', 'users', 'id', 'fk_reports_user_id')
        add_foreign_key('reports', 'scan_id', 'scans', 'id', 'fk_reports_scan_id')

        print("Creating chat_history table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                scan_id UUID,
                patient_id VARCHAR(50),
                question TEXT NOT NULL,
                answer TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        chat_history_columns = [
            "ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS user_id UUID;",
            "ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS scan_id UUID;",
            "ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS patient_id VARCHAR(50);",
            "ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS question TEXT;",
            "ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS answer TEXT;",
            "ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS message TEXT;",
            "ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS response TEXT;",
            "ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;",
        ]
        for statement in chat_history_columns:
            cursor.execute(statement)

        cursor.execute("""
            UPDATE chat_history
            SET
                question = COALESCE(question, message),
                answer = COALESCE(answer, response)
            WHERE question IS NULL OR answer IS NULL;
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_history_user_scan ON chat_history(user_id, scan_id, created_at);
        """)

        add_foreign_key('chat_history', 'user_id', 'users', 'id', 'fk_chat_history_user_id')

        print("Creating chat_sessions table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                title VARCHAR(255) NOT NULL,
                scan_id UUID,
                patient_id VARCHAR(50),
                is_archived BOOLEAN DEFAULT FALSE,
                is_favorite BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cursor.execute("""
            ALTER TABLE chat_sessions
            ADD COLUMN IF NOT EXISTS user_id UUID;
        """)

        cursor.execute("""
            ALTER TABLE chat_sessions
            ADD COLUMN IF NOT EXISTS scan_id UUID;
        """)

        cursor.execute("""
            ALTER TABLE chat_sessions
            ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
        """)

        cursor.execute("""
            ALTER TABLE chat_sessions
            ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;
        """)

        cursor.execute("""
            ALTER TABLE chat_sessions
            ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'English';
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
        """)

        add_foreign_key('chat_sessions', 'user_id', 'users', 'id', 'fk_chat_sessions_user_id')
        add_foreign_key('chat_sessions', 'scan_id', 'scans', 'id', 'fk_chat_sessions_scan_id')

        print("Altering chat_history table for sessions and metadata...")
        cursor.execute("""
            ALTER TABLE chat_history
            ADD COLUMN IF NOT EXISTS session_id UUID;
        """)

        cursor.execute("""
            ALTER TABLE chat_history
            ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'English';
        """)

        cursor.execute("""
            ALTER TABLE chat_history
            ADD COLUMN IF NOT EXISTS response_time FLOAT;
        """)

        cursor.execute("""
            ALTER TABLE chat_history
            ADD COLUMN IF NOT EXISTS model VARCHAR(100);
        """)

        cursor.execute("""
            ALTER TABLE chat_history
            ADD COLUMN IF NOT EXISTS tokens_used INTEGER;
        """)

        cursor.execute("""
            ALTER TABLE chat_history
            ADD COLUMN IF NOT EXISTS feedback BOOLEAN;
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
        """)

        add_foreign_key('chat_history', 'session_id', 'chat_sessions', 'id', 'fk_chat_history_session_id')

        print("Creating audit_logs table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                action VARCHAR(255) NOT NULL,
                resource_type VARCHAR(255),
                resource_id VARCHAR(255),
                metadata JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cursor.execute("""
            ALTER TABLE audit_logs
            ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
        """)

        cursor.execute("""
            ALTER TABLE audit_logs
            ADD COLUMN IF NOT EXISTS user_id UUID;
        """)

        cursor.execute("""
            ALTER TABLE audit_logs
            ADD COLUMN IF NOT EXISTS action VARCHAR(255);
        """)

        cursor.execute("""
            ALTER TABLE audit_logs
            ADD COLUMN IF NOT EXISTS resource_type VARCHAR(255);
        """)

        cursor.execute("""
            ALTER TABLE audit_logs
            ADD COLUMN IF NOT EXISTS resource_id VARCHAR(255);
        """)

        cursor.execute("""
            ALTER TABLE audit_logs
            ADD COLUMN IF NOT EXISTS metadata JSONB;
        """)

        cursor.execute("""
            ALTER TABLE audit_logs
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        """)

        add_foreign_key('audit_logs', 'user_id', 'users', 'id', 'fk_audit_logs_user_id')

        cursor.execute("DROP TABLE IF EXISTS doctor_notes CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS user_settings CASCADE;")

        print("Creating user_settings table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID UNIQUE NOT NULL,
                theme VARCHAR(50) DEFAULT 'light',
                language VARCHAR(50) DEFAULT 'en',
                assistant_language VARCHAR(50) DEFAULT 'en',
                voice_enabled BOOLEAN DEFAULT TRUE,
                speech_rate FLOAT DEFAULT 1.0,
                notifications BOOLEAN DEFAULT TRUE,
                email_notifications BOOLEAN DEFAULT TRUE,
                push_notifications BOOLEAN DEFAULT TRUE,
                high_contrast BOOLEAN DEFAULT FALSE,
                font_size VARCHAR(50) DEFAULT 'medium',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        add_foreign_key('user_settings', 'user_id', 'users', 'id', 'fk_user_settings_user_id')

        print("Creating doctor_notes table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS doctor_notes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                scan_id UUID NOT NULL,
                doctor_id UUID NOT NULL,
                title VARCHAR(255) NOT NULL,
                note TEXT NOT NULL,
                severity VARCHAR(50) DEFAULT 'Low',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        add_foreign_key('doctor_notes', 'doctor_id', 'users', 'id', 'fk_doctor_notes_doctor_id')
        add_foreign_key('doctor_notes', 'scan_id', 'scans', 'id', 'fk_doctor_notes_scan_id')

        print("Creating appointments table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS appointments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id UUID NOT NULL,
                doctor_id UUID NOT NULL,
                date DATE NOT NULL,
                time TIME NOT NULL,
                status VARCHAR(50) DEFAULT 'Scheduled',
                reason TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        add_foreign_key('appointments', 'patient_id', 'users', 'id', 'fk_appointments_patient_id')
        add_foreign_key('appointments', 'doctor_id', 'users', 'id', 'fk_appointments_doctor_id')

        print("Creating prescriptions table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prescriptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id UUID NOT NULL,
                doctor_id UUID NOT NULL,
                medicine VARCHAR(255) NOT NULL,
                dosage VARCHAR(100) NOT NULL,
                duration VARCHAR(100) NOT NULL,
                instructions TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        add_foreign_key('prescriptions', 'patient_id', 'users', 'id', 'fk_prescriptions_patient_id')
        add_foreign_key('prescriptions', 'doctor_id', 'users', 'id', 'fk_prescriptions_doctor_id')

        conn.commit()
        logger.info("Database tables created successfully")

    except Exception as e:
        try:
            if conn and not getattr(conn, 'closed', True):
                conn.rollback()
        except Exception as rollback_err:
            logger.warning(f"Database rollback failed during table creation: {rollback_err}")
        logger.error(f"Failed to create database tables: {e}")
        raise
    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()
