# -*- coding: utf-8 -*-
"""
LanguageService Module.
Automatically detects query language and holds default translation templates for 21 languages.
"""

import re
import unicodedata
from ..local_kb import MULTILINGUAL_DEFAULTS

class LanguageService:
    @staticmethod
    def detect_language(text: str) -> str:
        """
        Detect user's language using Unicode blocks and Latin stopwords.
        Returns one of the 21 supported languages.
        """
        if not text:
            return "English"

        # Check Unicode blocks first
        for char in text:
            val = ord(char)
            # Telugu: U+0C00 to U+0C7F
            if 0x0C00 <= val <= 0x0C7F:
                return "Telugu"
            # Devanagari (Hindi / Marathi): U+0900 to U+097F
            if 0x0900 <= val <= 0x097F:
                marathi_keywords = ["आहे", "नमस्कार", "मेंदू", "आरोग्य", "झाले", "काही"]
                if any(kw in text for kw in marathi_keywords):
                    return "Marathi"
                return "Hindi"
            # Tamil: U+0B80 to U+0BFF
            if 0x0B80 <= val <= 0x0BFF:
                return "Tamil"
            # Kannada: U+0C80 to U+0CFF
            if 0x0C80 <= val <= 0x0CFF:
                return "Kannada"
            # Malayalam: U+0D00 to U+0D7F
            if 0x0D00 <= val <= 0x0D7F:
                return "Malayalam"
            # Bengali: U+0980 to U+09FF
            if 0x0980 <= val <= 0x09FF:
                return "Bengali"
            # Gujarati: U+0A80 to U+0AFF
            if 0x0A80 <= val <= 0x0AFF:
                return "Gujarati"
            # Gurmukhi (Punjabi): U+0A00 to U+0A7F
            if 0x0A00 <= val <= 0x0A7F:
                return "Punjabi"
            # Cyrillic (Russian): U+0400 to U+04FF
            if 0x0400 <= val <= 0x04FF:
                return "Russian"
            # Arabic/Urdu: U+0600 to U+06FF
            if 0x0600 <= val <= 0x06FF:
                urdu_markers = ["ہے", "کیا", "ہوں", "ہیں", "تھا", "تھی"]
                if any(m in text for m in urdu_markers):
                    return "Urdu"
                return "Arabic"
            # Hangul (Korean): U+AC00 to U+D7AF
            if 0xAC00 <= val <= 0xD7AF or 0x1100 <= val <= 0x11FF:
                return "Korean"
            # Japanese Hiragana/Katakana: U+3040 to U+30FF
            if 0x3040 <= val <= 0x30FF:
                return "Japanese"
            # Chinese CJK: U+4E00 to U+9FFF
            if 0x4E00 <= val <= 0x9FFF:
                return "Chinese"

        # Latin stopwords checking for European languages
        clean_text = "".join(
            c for c in unicodedata.normalize("NFD", text.lower())
            if unicodedata.category(c) != "Mn"
        )
        words = set(re.findall(r'\w+', clean_text))

        french_stops = {"le", "la", "les", "et", "est", "dans", "une", "en", "que", "pour", "sante", "cerveau", "comment", "ca", "va", "bonjour", "demence"}
        spanish_stops = {"el", "la", "los", "y", "es", "en", "una", "que", "del", "para", "salud", "cerebro", "tengo", "como", "estas", "hola", "demencia"}
        german_stops = {"der", "die", "das", "und", "ist", "in", "eine", "zu", "mit", "gesundheit", "gehirn", "wie", "geht", "dir", "hallo", "demenz"}
        italian_stops = {"il", "la", "i", "e", "in", "una", "di", "per", "salute", "cervello", "come", "stai", "ciao", "demenza"}
        portuguese_stops = {"o", "a", "os", "e", "em", "uma", "de", "para", "saude", "cerebro", "como", "esta", "ola", "demencia"}

        scores = {
            "Spanish": len(words.intersection(spanish_stops)),
            "French": len(words.intersection(french_stops)),
            "German": len(words.intersection(german_stops)),
            "Italian": len(words.intersection(italian_stops)),
            "Portuguese": len(words.intersection(portuguese_stops)),
        }

        best_lang = None
        max_score = 0
        for lang_name, score in scores.items():
            if score > max_score:
                max_score = score
                best_lang = lang_name

        if best_lang:
            return best_lang

        return "English"

    @staticmethod
    def get_template(language: str, key: str) -> str:
        """Retrieve default templates for a specific language and key."""
        lang_dict = MULTILINGUAL_DEFAULTS.get(language, MULTILINGUAL_DEFAULTS.get("English", {}))
        return lang_dict.get(key, "")
