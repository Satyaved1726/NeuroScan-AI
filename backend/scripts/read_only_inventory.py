"""Read-only pre-flight inventory script for live Supabase PostgreSQL and Storage."""

import sys
from app.services.supabase_store import get_store
from app.core.config import get_settings
from supabase import create_client


def run_inventory():
    print("==================================================")
    print("NEUROSCAN AI — LIVE PRE-FLIGHT INVENTORY")
    print("==================================================")

    # 1. Database table inspection
    store = get_store()
    conn = store.db.get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    public_tables = [r[0] for r in cursor.fetchall()]
    print(f"\n[1] PUBLIC SCHEMA TABLES ({len(public_tables)} found):")
    total_db_rows = 0
    for t in public_tables:
        cursor.execute(f"SELECT count(*) FROM public.{t};")
        count = cursor.fetchone()[0]
        total_db_rows += count
        print(f"  - public.{t}: {count} rows")
    print(f"TOTAL PUBLIC DATABASE ROWS: {total_db_rows}")

    # 2. Check auth.users count (if accessible)
    try:
        cursor.execute("SELECT count(*) FROM auth.users;")
        auth_users_count = cursor.fetchone()[0]
        print(f"\n[2] AUTH SCHEMA ACCOUNTS:")
        print(f"  - auth.users: {auth_users_count} accounts")
    except Exception as e:
        print(f"\n[2] AUTH SCHEMA ACCOUNTS: Not directly queryable via current connection ({e})")
        conn.rollback()

    cursor.close()
    store.db.return_connection(conn)

    # 3. Storage inspection
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_key)
    print("\n[3] STORAGE BUCKETS & VISIBILITY:")
    buckets = client.storage.list_buckets()
    bucket_map = {b.name: b for b in buckets}

    total_clinical_objects = 0
    for b_name in ['mri-images', 'heatmaps', 'reports', 'models']:
        bucket_item = bucket_map.get(b_name)
        if not bucket_item:
            print(f"  - Bucket '{b_name}': NOT FOUND")
            continue

        is_public = getattr(bucket_item, 'public', False)
        # List objects in bucket
        try:
            objs = client.storage.from_(b_name).list()
            count = len(objs) if isinstance(objs, list) else 0
        except Exception as err:
            objs = []
            count = 0

        print(f"  - Bucket '{b_name}': Public={is_public}, Top-level entries={count}")
        if b_name != 'models':
            total_clinical_objects += count
        else:
            # Check models bucket specifically
            model_exists = False
            try:
                for item in objs:
                    name = item.get('name') if isinstance(item, dict) else getattr(item, 'name', '')
                    if name == 'neuroscan_model.keras':
                        model_exists = True
                        break
            except Exception:
                pass
            print(f"    -> models/neuroscan_model.keras verified present: {model_exists}")

    print(f"TOTAL CLINICAL STORAGE OBJECT ENTRIES: {total_clinical_objects}")
    print("==================================================")


if __name__ == '__main__':
    run_inventory()
