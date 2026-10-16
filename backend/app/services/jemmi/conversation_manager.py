# -*- coding: utf-8 -*-
"""
ConversationManager Module.
Acts as the central coordinator for the Jemmi AI Copilot.
Orchestrates language detection, caching, local intent engines, patient databases,
thread memories, RAG pipelines, and AI adapters.
"""

import time
import json
import logging
from typing import Dict, Any, Generator, Tuple
from .language_service import LanguageService
from .cache_service import global_cache
from .intent_engine import IntentEngine
from .memory_service import MemoryService
from .ai_router import AIRouter
from ...models.schemas import ChatResponse, ChatHistoryItem

logger = logging.getLogger(__name__)

class ConversationManager:
    @classmethod
    def handle_chat_request(
        cls,
        user_id: str,
        message: str,
        patient_context: Dict[str, Any],
        session_id: str | None,
        scan_id: str | None,
        patient_id: str | None,
        file_name: str | None = None,
        file_content: str | None = None,
        file_type: str | None = None,
        language: str | None = None,
    ) -> Dict[str, Any]:
        """
        Coordinates the V2 chat pipeline:
        Cache -> Local Greeting/FAQ -> RAG -> Fallback LLM completers.
        """
        start_time = time.time()

        # 1. Language detection
        lang = language or LanguageService.detect_language(message)

        # 2. Session setup
        session_id, _ = MemoryService.get_or_create_session(
            user_id=user_id,
            session_id=session_id,
            title=cls._generate_conversation_title(message),
            scan_id=scan_id,
            patient_id=patient_id,
            language=lang
        )
        MemoryService.update_session_language(user_id, session_id, lang)

        # 3. Check Smart Cache
        cache_key = f"{user_id}:{lang}:{message.strip().lower()}"
        cached_reply = global_cache.get(cache_key)
        if cached_reply and not file_content:
            saved = MemoryService.save_message(
                user_id=user_id,
                message=message,
                response=cached_reply['answer'],
                scan_id=scan_id,
                patient_id=patient_id,
                session_id=session_id,
                language=lang,
                response_time=cached_reply['response_time'],
                model=cached_reply['model'],
                tokens_used=cached_reply['tokens_used']
            )
            return {
                **cached_reply,
                'history_item': saved
            }

        # 4. Check Local Intent Engine
        intent = IntentEngine.classify_intent(message)
        if intent != "General Conversation" and intent != "MRI Interpretation" and not file_content:
            local_ans, local_lang = IntentEngine.handle_local_query(message, intent, user_id)
            end_time = time.time()
            res_time = round(end_time - start_time, 3)
            tokens_est = len(local_ans) // 4

            saved = MemoryService.save_message(
                user_id=user_id,
                message=message,
                response=local_ans,
                scan_id=scan_id,
                patient_id=patient_id,
                session_id=session_id,
                language=local_lang,
                response_time=res_time,
                model="local-intent-engine",
                tokens_used=tokens_est
            )

            payload = {
                'answer': local_ans,
                'safety_note': 'This response is informational only and must be reviewed by a clinician.',
                'clinical_explanation': '',
                'lifestyle_advice': [],
                'next_steps': [],
                'language': local_lang,
                'model': 'local-intent-engine',
                'response_time': res_time,
                'tokens_used': tokens_est,
                'history_item': saved
            }

            # Save to Cache
            global_cache.set(cache_key, payload)
            return payload

        # 5. Run AI Routing & RAG
        history_list = MemoryService.get_chat_history(user_id, session_id, limit=10)
        history_messages = MemoryService.build_history_context(history_list, max_turns=6)

        result = AIRouter.run_completion(
            message=message,
            patient_context=patient_context,
            language=lang,
            history=history_messages,
            file_name=file_name,
            file_content=file_content,
            file_type=file_type
        )

        end_time = time.time()
        res_time = round(end_time - start_time, 3)
        tokens_est = (len(message) + len(result['answer'])) // 4

        saved = MemoryService.save_message(
            user_id=user_id,
            message=message,
            response=result['answer'],
            scan_id=scan_id,
            patient_id=patient_id,
            session_id=session_id,
            language=lang,
            response_time=res_time,
            model=result['model'],
            tokens_used=tokens_est
        )

        payload = {
            **result,
            'response_time': res_time,
            'tokens_used': tokens_est,
            'history_item': saved
        }

        # Save to Cache
        global_cache.set(cache_key, payload)
        return payload

    @classmethod
    def handle_stream_request(
        cls,
        user_id: str,
        message: str,
        patient_context: Dict[str, Any],
        session_id: str | None,
        scan_id: str | None,
        patient_id: str | None,
        file_name: str | None = None,
        file_content: str | None = None,
        file_type: str | None = None,
        language: str | None = None,
    ) -> Generator[str, None, None]:
        """
        Coordinates the SSE streaming flow.
        Yields structured Server-Sent Events (SSE) string blocks:
        - session_created
        - chunk
        - completed
        - [DONE]
        """
        start_time = time.time()

        # 1. Detect prompt language
        lang = language or LanguageService.detect_language(message)

        # 2. Session setup
        session_id, was_created = MemoryService.get_or_create_session(
            user_id=user_id,
            session_id=session_id,
            title=cls._generate_conversation_title(message),
            scan_id=scan_id,
            patient_id=patient_id,
            language=lang
        )
        MemoryService.update_session_language(user_id, session_id, lang)

        if was_created:
            title = cls._generate_conversation_title(message)
            yield f"data: {json.dumps({'event': 'session_created', 'session_id': session_id, 'title': title})}\n\n"

        # 3. Check Smart Cache
        cache_key = f"{user_id}:{lang}:{message.strip().lower()}"
        cached_reply = global_cache.get(cache_key)
        intent = IntentEngine.classify_intent(message)

        if cached_reply or (intent != "General Conversation" and intent != "MRI Interpretation" and not file_content):
            if cached_reply:
                local_ans = cached_reply['answer']
                model_name = cached_reply['model']
                tokens_est = cached_reply['tokens_used']
            else:
                local_ans, local_lang = IntentEngine.handle_local_query(message, intent, user_id)
                model_name = "local-intent-engine"
                tokens_est = len(local_ans) // 4

            # Stream words with slight delay to mimic typing animations
            words = local_ans.split(" ")
            for idx, word in enumerate(words):
                space = " " if idx > 0 else ""
                yield f"data: {json.dumps({'event': 'chunk', 'text': space + word})}\n\n"
                time.sleep(0.002)

            end_time = time.time()
            res_time = round(end_time - start_time, 3)

            saved = MemoryService.save_message(
                user_id=user_id,
                message=message,
                response=local_ans,
                scan_id=scan_id,
                patient_id=patient_id,
                session_id=session_id,
                language=lang,
                response_time=res_time,
                model=model_name,
                tokens_used=tokens_est
            )

            if not cached_reply:
                global_cache.set(cache_key, {
                    'answer': local_ans,
                    'response_time': res_time,
                    'model': model_name,
                    'tokens_used': tokens_est
                })

            from app.routers.assistant import _chat_history_item
            history_item = _chat_history_item(saved)
            history_dict = json.loads(history_item.model_dump_json())

            yield f"data: {json.dumps({'event': 'completed', 'history_item': history_dict})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # 4. Stream AI Routing & RAG
        history_list = MemoryService.get_chat_history(user_id, session_id, limit=10)
        history_messages = MemoryService.build_history_context(history_list, max_turns=6)

        full_text = ""
        last_model_name = "gemini-flash-latest"

        for chunk, model_name in AIRouter.run_stream(
            message=message,
            patient_context=patient_context,
            language=lang,
            history=history_messages,
            file_name=file_name,
            file_content=file_content,
            file_type=file_type
        ):
            full_text += chunk
            last_model_name = model_name
            yield f"data: {json.dumps({'event': 'chunk', 'text': chunk})}\n\n"

        end_time = time.time()
        res_time = round(end_time - start_time, 3)
        tokens_est = (len(message) + len(full_text)) // 4

        saved = MemoryService.save_message(
            user_id=user_id,
            message=message,
            response=full_text,
            scan_id=scan_id,
            patient_id=patient_id,
            session_id=session_id,
            language=lang,
            response_time=res_time,
            model=last_model_name,
            tokens_used=tokens_est
        )

        global_cache.set(cache_key, {
            'answer': full_text,
            'response_time': res_time,
            'model': last_model_name,
            'tokens_used': tokens_est
        })

        from app.routers.assistant import _chat_history_item
        history_item = _chat_history_item(saved)
        history_dict = json.loads(history_item.model_dump_json())

        yield f"data: {json.dumps({'event': 'completed', 'history_item': history_dict})}\n\n"
        yield "data: [DONE]\n\n"

    @staticmethod
    def _generate_conversation_title(message: str) -> str:
        """Brief fallback title maker for new threads."""
        words = message.split()
        if len(words) > 4:
            return " ".join(words[:4]) + "..."
        return message or "New Conversation"
