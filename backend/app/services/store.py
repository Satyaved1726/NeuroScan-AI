"""Compatibility wrapper for the Supabase-backed store."""

from __future__ import annotations

from .supabase_store import StoredAnalysis, StoredUser, SupabaseStore, get_store, initialize_store

store = get_store()

__all__ = [
    'StoredAnalysis',
    'StoredUser',
    'SupabaseStore',
    'get_store',
    'initialize_store',
    'store',
]
