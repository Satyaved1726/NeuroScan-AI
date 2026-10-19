"""Standalone, safe retry script for purging clinical Supabase Storage objects.

Targets exclusively the three clinical buckets:
- 'mri-images'
- 'heatmaps'
- 'reports'

Safety Guarantees:
- Zero PostgreSQL connection (does not import or execute any SQL).
- Strictly protects the 'models' bucket and 'models/dementia_model.keras'.
- Strictly validates target bucket allowlist.
- Tracks all purge operations and verifies zero remaining files upon completion.
- Fail-closed: exits with nonzero code (1) on any failure or if files remain.
- Safe to re-run multiple times (idempotent).
"""

import sys
from typing import List, Optional, Set
from app.core.config import get_settings
from supabase import create_client

ALLOWED_CLINICAL_BUCKETS: tuple = ("mri-images", "heatmaps", "reports")
FORBIDDEN_BUCKETS: Set[str] = {"models", "model"}


def purge_folder_recursive(client, bucket: str, path: str = "") -> tuple[int, int]:
    """Recursively purges files within a bucket path.
    
    Returns (total_purged, purge_errors).
    """
    total_purged = 0
    purge_errors = 0

    try:
        items = client.storage.from_(bucket).list(path, {"limit": 1000})
    except Exception as e:
        print(f"ERROR: Failed to list items in {bucket}/{path}: {e}")
        return 0, 1

    for item in items:
        name = item.get("name") if isinstance(item, dict) else getattr(item, "name", "")
        meta = item.get("metadata") if isinstance(item, dict) else getattr(item, "metadata", None)
        sub_path = f"{path}/{name}" if path else name

        if meta is None or not meta:
            # Sub-directory -> recurse
            sub_purged, sub_errors = purge_folder_recursive(client, bucket, sub_path)
            total_purged += sub_purged
            purge_errors += sub_errors
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

    return total_purged, purge_errors


def verify_bucket_empty(client, bucket: str) -> tuple[bool, int]:
    """Verifies that a bucket is completely empty.
    
    Returns (is_empty, remaining_count).
    """
    try:
        items = client.storage.from_(bucket).list("", {"limit": 1000})
        remaining_count = len(items) if items else 0
        return (remaining_count == 0, remaining_count)
    except Exception as e:
        print(f"ERROR: Failed to verify bucket empty for '{bucket}': {e}")
        return False, -1


def purge_clinical_storage(client=None, target_buckets: Optional[List[str]] = None) -> int:
    """Executes a standalone clinical storage purge and verification.
    
    Returns 0 on complete success, 1 on any failure or remaining files.
    """
    print("==================================================")
    print("NEUROSCAN AI — CLINICAL STORAGE PURGE & RETRY")
    print("==================================================")

    if target_buckets is None:
        target_buckets = list(ALLOWED_CLINICAL_BUCKETS)

    # 1. Strict Allowlist and Guard Verification
    for b in target_buckets:
        if b in FORBIDDEN_BUCKETS or "model" in b.lower():
            print(f"FATAL: Target bucket '{b}' is in FORBIDDEN_BUCKETS list! Aborting immediately.")
            return 1
        if b not in ALLOWED_CLINICAL_BUCKETS:
            print(f"FATAL: Target bucket '{b}' is NOT in ALLOWED_CLINICAL_BUCKETS {ALLOWED_CLINICAL_BUCKETS}! Aborting.")
            return 1

    if client is None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_key:
            print("ERROR: Missing required Supabase credentials in settings.")
            return 1
        client = create_client(settings.supabase_url, settings.supabase_key)

    # 2. Verify models bucket is protected and dementia_model.keras is intact
    try:
        model_items = client.storage.from_("models").list("", {"limit": 100})
        model_names = [
            (i.get("name") if isinstance(i, dict) else getattr(i, "name", ""))
            for i in (model_items or [])
        ]
        if "dementia_model.keras" in model_names:
            print("  [OK] Protected model 'models/dementia_model.keras' verified present.")
        else:
            print("  [NOTE] 'models/dementia_model.keras' not found in root listing (may be in subfolder).")
    except Exception as e:
        print(f"  [NOTE] Read check on models bucket: {e}")

    # 3. Recursively purge only target clinical buckets
    total_purged = 0
    total_errors = 0

    for bucket in target_buckets:
        print(f"\nPurging clinical bucket: '{bucket}'...")
        purged, errors = purge_folder_recursive(client, bucket)
        total_purged += purged
        total_errors += errors
        print(f"  -> '{bucket}': {purged} file(s) purged, {errors} error(s).")

    # 4. Post-purge verification: Confirm all target buckets are completely empty
    print("\nVerifying all target clinical buckets are empty...")
    all_empty = True
    for bucket in target_buckets:
        is_empty, remaining = verify_bucket_empty(client, bucket)
        if not is_empty:
            all_empty = False
            print(f"  [FAILED] Bucket '{bucket}' still contains {remaining} item(s)!")
        else:
            print(f"  [OK] Bucket '{bucket}' verified empty (0 items).")

    # 5. Final exit status determination
    if total_errors == 0 and all_empty:
        print("\n==================================================")
        print("SUCCESS: Clinical storage purge completed cleanly.")
        print(f"Total files purged: {total_purged}. Zero files remain.")
        print("==================================================")
        return 0
    else:
        print("\n==================================================")
        print("FATAL: Clinical storage purge completed with defects!")
        print(f"Errors: {total_errors}, All Empty: {all_empty}")
        print("==================================================")
        return 1


if __name__ == "__main__":
    sys.exit(purge_clinical_storage())
