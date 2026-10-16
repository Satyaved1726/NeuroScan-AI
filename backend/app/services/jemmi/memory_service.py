# -*- coding: utf-8 -*-
"""
MemoryService Module.
Manages patient chat history logging, retrieving thread summaries,
updating active language parameters, and compressing chat history context.
"""

import logging
from typing import List, Dict, Any, Tuple
from ..store import get_store

logger = logging.getLogger(__name__)

class MemoryService:
    @staticmethod
    def get_chat_history(user_id: str, session_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Retrieve historical message logs for a session."""
        store = get_store()
        return store.list_chat_history_by_session(user_id, session_id, limit=limit)

    @staticmethod
    def save_message(
        user_id: str,
        message: str,
        response: str,
        scan_id: str | None,
        patient_id: str | None,
        session_id: str | None,
        language: str,
        response_time: float,
        model: str,
        tokens_used: int,
    ) -> Dict[str, Any]:
        """Log a new question-answer turn in the postgres history database."""
        store = get_store()
        return store.save_chat_history(
            user_id=user_id,
            message=message,
            response=response,
            scan_id=scan_id,
            patient_id=patient_id,
            session_id=session_id,
            language=language,
            response_time=response_time,
            model=model,
            tokens_used=tokens_used,
        )

    @staticmethod
    def get_or_create_session(
        user_id: str,
        session_id: str | None,
        title: str,
        scan_id: str | None,
        patient_id: str | None,
        language: str = "English",
    ) -> Tuple[str, bool]:
        """
        Loads the active session or creates a new session.
        Returns: (session_id, was_created)
        """
        store = get_store()
        if not session_id:
            session = store.create_chat_session(
                user_id=user_id,
                title=title,
                scan_id=scan_id,
                patient_id=patient_id,
                language=language,
            )
            return session['id'], True
        return session_id, False

    @staticmethod
    def update_session_language(user_id: str, session_id: str, language: str) -> None:
        """Update preferred language preference on the active session thread."""
        store = get_store()
        try:
            sessions = store.list_chat_sessions(user_id)
            active_sess = next((s for s in sessions if s['id'] == session_id), None)
            if active_sess and active_sess.get('language') != language:
                store.update_chat_session(session_id, user_id, language=language)
        except Exception as e:
            logger.warning(f"Failed to update session language preference: {e}")

    @staticmethod
    def build_history_context(history: List[Dict[str, Any]], max_turns: int = 6) -> List[Dict[str, str]]:
        """
        Compresses previous conversation logs:
        - Keeps the last `max_turns` (default 6) fully.
        - Summarizes older turns in a single system summary to save tokens.
        """
        history_messages = []
        if not history:
            return history_messages

        sorted_history = sorted(history, key=lambda x: x.get('created_at', ''))

        if len(sorted_history) > max_turns:
            older = sorted_history[:-max_turns]
            earlier_topics = [item.get('question', '')[:35] for item in older if item.get('question')]
            history_messages.append({
                "role": "system",
                "content": f"Brief context of previous conversation queries: {', '.join(earlier_topics)}"
            })
            for item in sorted_history[-max_turns:]:
                history_messages.append({"role": "user", "content": item['question']})
                history_messages.append({"role": "assistant", "content": item.get('answer', '')})
        else:
            for item in sorted_history:
                history_messages.append({"role": "user", "content": item['question']})
                history_messages.append({"role": "assistant", "content": item.get('answer', '')})

        return history_messages
