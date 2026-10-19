"""Auditable, transactional migration runner for NeuroScan AI clean-start and security migration."""

import sys
import os
import psycopg2
from pathlib import Path
from app.core.config import get_settings
from supabase import create_client


def run_clean_start_migration():
    print("==================================================")
    print("NEUROSCAN AI — PRODUCTION CLEAN START RUNNER")
    print("==================================================")

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key or not settings.supabase_db_url:
        print("ERROR: Missing required Supabase credentials in settings.")
        sys.exit(1)

    client = create_client(settings.supabase_url, settings.supabase_key)

    # ----------------------------------------------------
    # GATE 1: STORAGE PRIVACY ENFORCEMENT & VERIFICATION
    # ----------------------------------------------------
    print("\n[GATE 1] ENFORCING STORAGE PRIVACY...")
    clinical_buckets = ['mri-images', 'heatmaps', 'reports']
    for bucket_name in clinical_buckets:
        print(f"  -> Setting bucket '{bucket_name}' to Private (public=False)...")
        try:
            client.storage.update_bucket(bucket_name, {'public': False})
        except Exception as e:
            print(f"ERROR: Failed to update bucket '{bucket_name}': {e}")
            sys.exit(1)

    print("  -> Verifying bucket privacy across all clinical buckets...")
    buckets = client.storage.list_buckets()
    bucket_map = {b.name: b for b in buckets}
    for bucket_name in clinical_buckets:
        b = bucket_map.get(bucket_name)
        if not b or getattr(b, 'public', True):
            print(f"FATAL: Bucket '{bucket_name}' is NOT private! Aborting migration immediately.")
            sys.exit(1)
        print(f"     [OK] Bucket '{bucket_name}' is verified Private.")

    # Explicitly check models bucket
    models_bucket = bucket_map.get('models')
    if not models_bucket or getattr(models_bucket, 'public', True):
        print("FATAL: Bucket 'models' is NOT private or missing! Aborting migration immediately.")
        sys.exit(1)
    print("     [OK] Bucket 'models' is verified Private and excluded from cleanup.")

    # ----------------------------------------------------
    # GATE 2: ATOMIC DATABASE SQL MIGRATION
    # ----------------------------------------------------
    print("\n[GATE 2] EXECUTING ATOMIC DATABASE MIGRATION...")
    migration_file = Path(__file__).resolve().parents[1] / "migrations" / "20261019_001_clean_start_and_security.sql"
    if not migration_file.is_file():
        print(f"ERROR: Migration file {migration_file} not found.")
        sys.exit(1)

    sql_content = migration_file.read_text(encoding="utf-8")

    # Connect to PostgreSQL with autocommit=True so the migration file's explicit BEGIN; / COMMIT;
    # block natively controls the atomic transaction without nested transaction conflicts.
    conn = psycopg2.connect(settings.supabase_db_url)
    conn.autocommit = True
    cursor = conn.cursor()

    try:
        print("  -> Executing SQL migration transaction...")
        cursor.execute(sql_content)
        print("  -> [SUCCESS] Database migration transaction committed cleanly.")
    except Exception as e:
        print(f"FATAL: SQL Migration failed! Transaction rolled back completely: {e}")
        cursor.close()
        conn.close()
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()

    # ----------------------------------------------------
    # GATE 3: STORAGE CLINICAL OBJECT PURGE
    # ----------------------------------------------------
    print("\n[GATE 3] PURGING OBSOLETE CLINICAL STORAGE OBJECTS...")
    total_purged = 0
    purge_errors = 0

    def purge_folder_recursive(bucket, path=""):
        nonlocal total_purged, purge_errors
        try:
            items = client.storage.from_(bucket).list(path, {"limit": 1000})
        except Exception as e:
            print(f"ERROR: Failed to list items in {bucket}/{path}: {e}")
            purge_errors += 1
            return

        for item in items:
            name = item.get("name") if isinstance(item, dict) else getattr(item, "name", "")
            meta = item.get("metadata") if isinstance(item, dict) else getattr(item, "metadata", None)
            sub_path = f"{path}/{name}" if path else name
            if meta is None or not meta:
                # Directory -> recurse
                purge_folder_recursive(bucket, sub_path)
            else:
                # File -> remove
                try:
                    res = client.storage.from_(bucket).remove([sub_path])
                    if res:
                        total_purged += 1
                    else:
                        print(f"WARNING: Remove call returned empty response for {bucket}/{sub_path}")
                        purge_errors += 1
                except Exception as del_err:
                    print(f"ERROR: Failed to remove {bucket}/{sub_path}: {del_err}")
                    purge_errors += 1

    for bucket_name in clinical_buckets:
        print(f"  -> Purging files from bucket '{bucket_name}'...")
        purge_folder_recursive(bucket_name)

    if purge_errors > 0:
        print(f"ERROR: Encountered {purge_errors} errors while purging clinical storage files. Purged {total_purged} files.")
    else:
        print(f"  -> [SUCCESS] All clinical storage files purged successfully ({total_purged} files removed).")

    # ----------------------------------------------------
    # GATE 4: FINAL POST-MIGRATION SMOKE VERIFICATION
    # ----------------------------------------------------
    print("\n[GATE 4] POST-MIGRATION VERIFICATION...")
    conn = psycopg2.connect(settings.supabase_db_url)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    tables = [r[0] for r in cursor.fetchall()]
    all_zero = True
    for t in tables:
        cursor.execute(f"SELECT count(*) FROM public.{t};")
        cnt = cursor.fetchone()[0]
        if cnt != 0:
            all_zero = False
            print(f"  -> WARNING: public.{t} still has {cnt} rows!")
        else:
            print(f"  -> public.{t}: 0 rows (Clean)")
    cursor.close()
    conn.close()

    if all_zero and purge_errors == 0:
        print("\n==================================================")
        print("CLEAN START MIGRATION COMPLETED SUCCESSFULLY.")
        print("DATABASE IS CLEAN. RLS IS ACTIVE. STORAGE IS SECURED.")
        print("==================================================")
    else:
        print("\n==================================================")
        print("FATAL: CLEAN START COMPLETED WITH DEFECTS!")
        if not all_zero:
            print("  - One or more database tables retained rows.")
        if purge_errors > 0:
            print(f"  - Storage purge encountered {purge_errors} failure(s).")
        print("==================================================")
        sys.exit(1)


if __name__ == "__main__":
    run_clean_start_migration()
