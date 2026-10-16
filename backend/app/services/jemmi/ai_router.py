# -*- coding: utf-8 -*-
"""
AIRouter Module.
Inspects local SQLite RAG database, binds matches to LLM prompts,
and runs downstream LLM completion adapters with automatic API error failovers.
"""

import logging
from typing import Dict, Any, List, Generator, Tuple
from .knowledge_service import search_local_rag
from .provider_adapter import ProviderAdapter
from .language_service import LanguageService
from ...core.config import get_settings

logger = logging.getLogger(__name__)

class AIRouter:
    @classmethod
    def resolve_rag_context(cls, message: str) -> str:
        """Query offline BM25 SQLite index for relevant medical records/guidance."""
        try:
            results = search_local_rag(message, top_k=3)
            if results and results[0]["score"] >= 1.5:
                return "\n\n".join([f"Source ({r['title']}): {r['content']}" for r in results])
        except Exception as e:
            logger.warning(f"Failed to query local RAG index: {e}")
        return ""

    @classmethod
    def get_system_prompt(cls, language: str, rag_context: str) -> str:
        """Generate clinical system prompt injected with RAG context."""
        system_prompt = (
            "You are Jemmi AI, a professional brain health copilot. Rules:\n"
            "1. Focus ONLY on brain health, dementia, MRI scans, neurology, cognitive wellness. Politely refuse other topics.\n"
            "2. Responses must be professional, friendly, extremely concise (max 150-250 words), and strictly structured in this template:\n"
            "Summary: ...\n"
            "Prediction: ...\n"
            "Confidence: ...\n"
            "Risk Level: ...\n"
            "Explanation: ...\n"
            "Recommendations: ...\n"
            "When to Consult a Doctor: ...\n"
            "Safety Note: ...\n"
            "3. Never diagnose or prescribe medication. Always append this exact clinical disclaimer at the very end of your response:\n"
            "\"This AI-generated interpretation supports clinical decision-making and should not replace evaluation by a qualified neurologist.\"\n"
            f"4. Respond in {language}."
        )
        if rag_context:
            system_prompt += (
                "\n\nHere is highly relevant local clinical/medical documentation to help answer the query. "
                "Please prioritize this information and base your response on these facts:\n"
                f"{rag_context}"
        )
        return system_prompt

    @classmethod
    def run_completion(
        cls,
        message: str,
        patient_context: Dict[str, Any],
        language: str,
        history: List[Dict[str, str]],
        file_name: str | None,
        file_content: str | None,
        file_type: str | None,
    ) -> Dict[str, Any]:
        """
        Executes static LLM completion with Groq -> Gemini -> OpenAI -> Local RAG fallback hierarchy.
        """
        settings = get_settings()
        rag_context = cls.resolve_rag_context(message)
        system_prompt = cls.get_system_prompt(language, rag_context)

        user_prompt = f"Patient context:\n{json_dumps(patient_context)}\n\nQuery: {message}"
        if file_content and file_type and not (file_type.startswith('image/') or file_type == 'application/pdf'):
            user_prompt = f"Attached document '{file_name}':\n```\n{file_content}\n```\n\n" + user_prompt

        # 1. Groq (Primary)
        if settings.groq_api_key:
            ans = ProviderAdapter.call_groq(system_prompt, user_prompt, history, settings)
            if ans:
                model_name = settings.groq_model + (" (local-rag)" if rag_context else "")
                return cls._build_response_payload(ans, language, model_name)

        # 2. Gemini (Fallback 1)
        if settings.gemini_api_key:
            ans = ProviderAdapter.call_gemini(system_prompt, user_prompt, history, file_content, file_type, settings)
            if ans:
                model_name = settings.gemini_model + (" (local-rag)" if rag_context else "")
                return cls._build_response_payload(ans, language, model_name)

        # 3. OpenAI (Fallback 2)
        if getattr(settings, "openai_api_key", None):
            ans = ProviderAdapter.call_openai(system_prompt, user_prompt, history, settings)
            if ans:
                model_name = getattr(settings, "openai_model", "gpt-4o-mini") + (" (local-rag)" if rag_context else "")
                return cls._build_response_payload(ans, language, model_name)

        # 4. Offline RAG Fallback
        if rag_context:
            offline_msg = LanguageService.get_template(language, "offline")
            fallback_text = f"{offline_msg}\n\n### 🧠 Offline Medical Database Matches:\n{rag_context}"
            return cls._build_response_payload(fallback_text, language, "local-rag-db")

        # 5. Patient Record Fallback
        from .patient_data_service import PatientDataService
        fallback_text = PatientDataService.fetch_and_format("Show my MRI", patient_context.get("patient", {}).get("patient_id", ""))
        return cls._build_response_payload(fallback_text, language, "local-patient-db")

    @classmethod
    def run_stream(
        cls,
        message: str,
        patient_context: Dict[str, Any],
        language: str,
        history: List[Dict[str, str]],
        file_name: str | None,
        file_content: str | None,
        file_type: str | None,
    ) -> Generator[Tuple[str, str], None, None]:
        """
        Executes streaming LLM generator.
        Yields: (text_chunk, model_name)
        """
        settings = get_settings()
        rag_context = cls.resolve_rag_context(message)
        system_prompt = cls.get_system_prompt(language, rag_context)

        user_prompt = f"Patient context:\n{json_dumps(patient_context)}\n\nQuery: {message}"
        if file_content and file_type and not (file_type.startswith('image/') or file_type == 'application/pdf'):
            user_prompt = f"Attached document '{file_name}':\n```\n{file_content}\n```\n\n" + user_prompt

        # 1. Groq (Primary)
        if settings.groq_api_key:
            model_name = settings.groq_model + (" (local-rag)" if rag_context else "")
            success = False
            try:
                for chunk in ProviderAdapter.stream_groq(system_prompt, user_prompt, history, settings):
                    yield chunk, model_name
                    success = True
                if success:
                    return
            except Exception as e:
                logger.warning(f"Groq stream router exception: {e}")

        # 2. Gemini (Fallback 1)
        if settings.gemini_api_key:
            model_name = settings.gemini_model + (" (local-rag)" if rag_context else "")
            success = False
            try:
                for chunk in ProviderAdapter.stream_gemini(system_prompt, user_prompt, history, file_content, file_type, settings):
                    yield chunk, model_name
                    success = True
                if success:
                    return
            except Exception as e:
                logger.warning(f"Gemini stream router exception: {e}")

        # 3. OpenAI (Fallback 2)
        if getattr(settings, "openai_api_key", None):
            model_name = getattr(settings, "openai_model", "gpt-4o-mini") + (" (local-rag)" if rag_context else "")
            success = False
            try:
                for chunk in ProviderAdapter.stream_openai(system_prompt, user_prompt, history, settings):
                    yield chunk, model_name
                    success = True
                if success:
                    return
            except Exception as e:
                logger.warning(f"OpenAI stream router exception: {e}")

        # 4. Offline Fallback
        disclaimer = LanguageService.get_template(language, "disclaimer")
        if rag_context:
            offline_msg = LanguageService.get_template(language, "offline")
            yield f"{offline_msg}\n\n### 🧠 Offline Medical Database Matches:\n{rag_context}\n\n{disclaimer}", "local-rag-db"
        else:
            from .patient_data_service import PatientDataService
            fallback_text = PatientDataService.fetch_and_format("Show my MRI", patient_context.get("patient", {}).get("patient_id", ""))
            yield f"{fallback_text}\n\n{disclaimer}", "local-patient-db"

    @staticmethod
    def _build_response_payload(answer: str, language: str, model_name: str) -> Dict[str, Any]:
        disclaimer = LanguageService.get_template(language, "disclaimer")
        if disclaimer not in answer:
            answer = f"{answer.strip()}\n\n{disclaimer}"
        return {
            'answer': answer,
            'safety_note': 'This response is informational only and must be reviewed by a clinician.',
            'clinical_explanation': '',
            'lifestyle_advice': [],
            'next_steps': [],
            'language': language,
            'model': model_name
        }


# Helper JSON dumper to avoid imports error
def json_dumps(data: Any) -> str:
    try:
        import json
        return json.dumps(data)
    except Exception:
        return str(data)
