"""CLI administrative tool to inspect, approve, or reject clinician doctor applications."""

import argparse
import sys
import os

# Add parent directory to sys.path to allow imports
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from app.services.supabase_store import get_store


def list_applications(status_filter=None):
    store = get_store()
    apps = store.list_doctor_applications(status=status_filter)
    if not apps:
        print(f"No doctor applications found{' with status ' + status_filter if status_filter else ''}.")
        return

    print("=" * 90)
    print(f"{'ID':<36} | {'EMAIL':<30} | {'NAME':<20} | {'STATUS':<10}")
    print("=" * 90)
    for app in apps:
        print(f"{app['id']:<36} | {app['email']:<30} | {app['full_name'][:20]:<20} | {app['status']:<10}")
        print(f"  License: {app['license_number']} | Specialization: {app['specialization']} | Affiliation: {app['hospital_affiliation']}")
        if app.get('notes'):
            print(f"  Notes: {app['notes']}")
        print("-" * 90)


def approve_application(target, notes=None):
    store = get_store()
    target_clean = target.strip().lower()

    # Find application by ID or email
    app = store.get_doctor_application_by_id(target_clean)
    if not app:
        app = store.get_doctor_application_by_email(target_clean)

    if not app:
        print(f"Error: Doctor application not found for '{target}'.", file=sys.stderr)
        sys.exit(1)

    print(f"Found application: {app['id']} for {app['full_name']} ({app['email']}) [Status: {app['status']}]")

    if app['status'] == 'approved':
        print(f"Application is already approved. User role is Doctor.")
        return

    admin_reviewer_id = "00000000-0000-0000-0000-000000000000"
    updated = store.approve_doctor_application(
        application_id=app['id'],
        reviewer_id=admin_reviewer_id,
        notes=notes or "Approved via CLI administrative tool"
    )

    print(f"SUCCESS: Account {app['email']} elevated to Doctor role.")
    print(f"Application status updated to: {updated.get('status')}")


def reject_application(target, notes=None):
    store = get_store()
    target_clean = target.strip().lower()

    app = store.get_doctor_application_by_id(target_clean)
    if not app:
        app = store.get_doctor_application_by_email(target_clean)

    if not app:
        print(f"Error: Doctor application not found for '{target}'.", file=sys.stderr)
        sys.exit(1)

    admin_reviewer_id = "00000000-0000-0000-0000-000000000000"
    updated = store.reject_doctor_application(
        application_id=app['id'],
        reviewer_id=admin_reviewer_id,
        notes=notes or "Rejected via CLI administrative tool"
    )

    print(f"SUCCESS: Application for {app['email']} marked as rejected.")
    print(f"Application status updated to: {updated.get('status')}")


def main():
    parser = argparse.ArgumentParser(description="NeuroScan AI Clinician Application Administration CLI")
    parser.add_argument("--list", action="store_true", help="List all doctor applications")
    parser.add_argument("--status", type=str, choices=["pending", "approved", "rejected"], help="Filter by status")
    parser.add_argument("--approve", type=str, metavar="IDENTIFIER", help="Approve doctor application by email or ID")
    parser.add_argument("--reject", type=str, metavar="IDENTIFIER", help="Reject doctor application by email or ID")
    parser.add_argument("--notes", type=str, help="Optional administrative review notes")

    args = parser.parse_args()

    if args.list:
        list_applications(args.status)
    elif args.approve:
        approve_application(args.approve, args.notes)
    elif args.reject:
        reject_application(args.reject, args.notes)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
