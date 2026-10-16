# -*- coding: utf-8 -*-
"""
ProviderAdapter Module.
Abstracts calls to OpenAI, Groq, Gemini, and DeepSeek,
providing resilient fallback logic.
"""

import json
import logging
import requests
from typing import Any, List, Dict, Generator, Optional
from ...core.config import get_settings

logger = logging.getLogger(__name__)

class ProviderAdapter:
    @staticmethod
    def call_groq(system_prompt: str, user_prompt: str, history: List[Dict[str, str]], settings: Any) -> Optional[str]:
        if not settings.groq_api_key:
            return None
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json"
        }
        messages = [{"role": "system", "content": system_prompt}]
        for h in history:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": user_prompt})

        payload = {
            "model": settings.groq_model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1024
        }
        try:
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=8)
            if res.status_code == 200:
                return res.json()["choices"][0]["message"]["content"]
            else:
                logger.warning(f"Groq status error: {res.status_code} - {res.text}")
        except Exception as e:
            logger.warning(f"Groq API call exception: {e}")
        return None

    @staticmethod
    def call_gemini(system_prompt: str, user_prompt: str, history: List[Dict[str, str]], file_content: Optional[str], file_type: Optional[str], settings: Any) -> Optional[str]:
        if not settings.gemini_api_key:
            return None
        parts = []
        if file_content and file_type and (file_type.startswith('image/') or file_type == 'application/pdf'):
            base64_data = file_content.split(',', 1)[1] if ',' in file_content else file_content
            parts.append({
                'inlineData': {
                    'mimeType': file_type,
                    'data': base64_data
                }
            })

        full_prompt = system_prompt + "\n\n" + user_prompt
        parts.append({'text': full_prompt})

        payload = {
            'contents': [{'role': 'user', 'parts': parts}],
            'generationConfig': {'temperature': 0.2, 'maxOutputTokens': 1024}
        }
        endpoint = f'https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={settings.gemini_api_key}'
        try:
            res = requests.post(endpoint, json=payload, timeout=8)
            if res.status_code == 200:
                data = res.json()
                return data['candidates'][0]['content']['parts'][0]['text']
            else:
                logger.warning(f"Gemini status error: {res.status_code} - {res.text}")
        except Exception as e:
            logger.warning(f"Gemini API call exception: {e}")
        return None

    @staticmethod
    def call_openai(system_prompt: str, user_prompt: str, history: List[Dict[str, str]], settings: Any) -> Optional[str]:
        openai_key = getattr(settings, "openai_api_key", None)
        if not openai_key:
            return None
        headers = {
            "Authorization": f"Bearer {openai_key}",
            "Content-Type": "application/json"
        }
        messages = [{"role": "system", "content": system_prompt}]
        for h in history:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": user_prompt})

        openai_model = getattr(settings, "openai_model", "gpt-4o-mini")
        payload = {
            "model": openai_model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1024
        }
        try:
            res = requests.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers, timeout=8)
            if res.status_code == 200:
                return res.json()["choices"][0]["message"]["content"]
            else:
                logger.warning(f"OpenAI status error: {res.status_code} - {res.text}")
        except Exception as e:
            logger.warning(f"OpenAI API call exception: {e}")
        return None

    @staticmethod
    def call_deepseek(system_prompt: str, user_prompt: str, history: List[Dict[str, str]], settings: Any) -> Optional[str]:
        deepseek_key = getattr(settings, "deepseek_api_key", None)
        if not deepseek_key:
            return None
        headers = {
            "Authorization": f"Bearer {deepseek_key}",
            "Content-Type": "application/json"
        }
        messages = [{"role": "system", "content": system_prompt}]
        for h in history:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": user_prompt})

        deepseek_model = getattr(settings, "deepseek_model", "deepseek-chat")
        payload = {
            "model": deepseek_model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1024
        }
        try:
            res = requests.post("https://api.deepseek.com/v1/chat/completions", json=payload, headers=headers, timeout=8)
            if res.status_code == 200:
                return res.json()["choices"][0]["message"]["content"]
            else:
                logger.warning(f"DeepSeek status error: {res.status_code} - {res.text}")
        except Exception as e:
            logger.warning(f"DeepSeek API call exception: {e}")
        return None

    # --- STREAMING UTILITIES ---

    @staticmethod
    def stream_groq(system_prompt: str, user_prompt: str, history: List[Dict[str, str]], settings: Any) -> Generator[str, None, None]:
        if not settings.groq_api_key:
            return
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json"
        }
        messages = [{"role": "system", "content": system_prompt}]
        for h in history:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": user_prompt})

        payload = {
            "model": settings.groq_model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1024,
            "stream": True
        }
        res = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, stream=True, timeout=8)
        if res.status_code == 200:
            for line in res.iter_lines():
                if not line:
                    continue
                line_str = line.decode('utf-8').strip()
                if line_str.startswith('data: '):
                    data_str = line_str[6:].strip()
                    if data_str == '[DONE]':
                        break
                    try:
                        chunk = json.loads(data_str)
                        val = chunk["choices"][0]["delta"].get("content", "")
                        if val:
                            yield val
                    except Exception:
                        pass
        else:
            raise Exception(f"Groq API error {res.status_code}")

    @staticmethod
    def stream_gemini(system_prompt: str, user_prompt: str, history: List[Dict[str, str]], file_content: Optional[str], file_type: Optional[str], settings: Any) -> Generator[str, None, None]:
        if not settings.gemini_api_key:
            return
        parts = []
        if file_content and file_type and (file_type.startswith('image/') or file_type == 'application/pdf'):
            base64_data = file_content.split(',', 1)[1] if ',' in file_content else file_content
            parts.append({
                'inlineData': {
                    'mimeType': file_type,
                    'data': base64_data
                }
            })

        full_prompt = system_prompt + "\n\n" + user_prompt
        parts.append({'text': full_prompt})

        payload = {
            'contents': [{'role': 'user', 'parts': parts}],
            'generationConfig': {'temperature': 0.2, 'maxOutputTokens': 1024}
        }
        endpoint = f'https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:streamGenerateContent?key={settings.gemini_api_key}&alt=sse'
        res = requests.post(endpoint, json=payload, stream=True, timeout=8)
        if res.status_code == 200:
            for line in res.iter_lines():
                if not line:
                    continue
                line_str = line.decode('utf-8').strip()
                if line_str.startswith('data: '):
                    data_str = line_str[6:].strip()
                    if data_str == '[DONE]':
                        break
                    try:
                        chunk = json.loads(data_str)
                        text = chunk['candidates'][0]['content']['parts'][0]['text']
                        yield text
                    except Exception:
                        pass
        else:
            raise Exception(f"Gemini API error {res.status_code}")

    @staticmethod
    def stream_openai(system_prompt: str, user_prompt: str, history: List[Dict[str, str]], settings: Any) -> Generator[str, None, None]:
        openai_key = getattr(settings, "openai_api_key", None)
        if not openai_key:
            return
        headers = {
            "Authorization": f"Bearer {openai_key}",
            "Content-Type": "application/json"
        }
        messages = [{"role": "system", "content": system_prompt}]
        for h in history:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": user_prompt})

        openai_model = getattr(settings, "openai_model", "gpt-4o-mini")
        payload = {
            "model": openai_model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1024,
            "stream": True
        }
        res = requests.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers, stream=True, timeout=8)
        if res.status_code == 200:
            for line in res.iter_lines():
                if not line:
                    continue
                line_str = line.decode('utf-8').strip()
                if line_str.startswith('data: '):
                    data_str = line_str[6:].strip()
                    if data_str == '[DONE]':
                        break
                    try:
                        chunk = json.loads(data_str)
                        val = chunk["choices"][0]["delta"].get("content", "")
                        if val:
                            yield val
                    except Exception:
                        pass
        else:
            raise Exception(f"OpenAI streaming error {res.status_code}")
