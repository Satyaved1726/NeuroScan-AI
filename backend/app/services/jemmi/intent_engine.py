# -*- coding: utf-8 -*-
"""
IntentEngine Module.
Classifies user queries to identify greetings, goodbye, help, navigation commands,
FAQ matches, medical definitions, and database query keywords.
"""

import re
from typing import Tuple
from .language_service import LanguageService
from .patient_data_service import PatientDataService
from ..local_kb import MEDICAL_KB, FAQ_KB

class IntentEngine:
    @staticmethod
    def classify_intent(message: str) -> str:
        """
        Classifies user queries locally.
        Returns the category label (e.g. "Greeting", "Navigation:Dashboard", etc.).
        """
        normalized = message.lower().strip()

        # 1. MRI Explanation (Checked FIRST to prevent matching 'my mri')
        mri_explanation_patterns = [
            r"\bexplain my mri\b", r"\bexplain the scan\b", r"\bexplain mri\b",
            r"\bexplain report\b", r"\binterpret my mri\b", r"\binterpret scan\b"
        ]
        if any(re.search(pat, normalized) for pat in mri_explanation_patterns):
            return "MRI Interpretation"

        # 2. Conversational greetings, goodbyes, thanks, and help
        greetings = {"hello", "hi", "hey", "good morning", "good afternoon", "namaste", "hola", "bonjour", "hallo"}
        goodbyes = {"bye", "goodbye", "see you", "chao", "au revoir", "tschüss"}
        thanks = {"thank you", "thanks", "thank", "appreciate", "gracias", "merci", "danke"}
        help_words = {"help", "what can you do", "commands", "menu", "ayuda", "aide"}

        if any(g in normalized for g in greetings):
            return "Greeting"
        if any(g in normalized for g in goodbyes):
            return "Goodbye"
        if any(t in normalized for t in thanks):
            return "Thank You"
        if any(h in normalized for h in help_words):
            return "Help"

        # 3. Dashboard/UI Navigation commands
        nav_patterns = {
            "Dashboard": [r"\bdashboard\b", r"\bhome\b", r"\bmain screen\b"],
            "Upload MRI": [r"\bupload mri\b", r"\bupload scan\b", r"\bupload image\b", r"\bnew scan\b"],
            "Generate Report": [r"\bgenerate report\b", r"\bcreate report\b", r"\banalyze scan\b", r"\banalysis\b"],
            "Download Report": [r"\bdownload report\b", r"\bget report\b", r"\bexport report\b"],
            "Patient History": [r"\bpatient history\b", r"\bhistory list\b", r"\bprevious queries\b"],
            "Appointments": [r"\bappointments\b", r"\bappointment\b", r"\bschedule\b", r"\bbooking\b"],
            "Settings": [r"\bsettings\b", r"\boptions\b", r"\bpreferences\b"],
            "Language Change": [r"\bchange language\b", r"\blanguage\b", r"\bselect language\b", r"\btranslate to\b"],
            "Voice Mode": [r"\bvoice mode\b", r"\bvoice settings\b", r"\benable voice\b", r"\bspeak\b"]
        }

        for intent, patterns in nav_patterns.items():
            if any(re.search(pat, normalized) for pat in patterns):
                return f"Navigation:{intent}"

        # 4. Database Query keywords
        db_patterns = {
            "Show my MRI": [r"\bshow my mri\b", r"\bshow mri\b", r"\bview mri\b", r"\bmy mri\b"],
            "Latest report": [r"\blatest report\b", r"\bcurrent report\b", r"\bmy report\b", r"\bshow report\b"],
            "Prediction history": [r"\bprediction history\b", r"\bhistory of scans\b", r"\bscan history\b", r"\ball scans\b"],
            "Confidence": [r"\bconfidence\b", r"\bconfidence score\b", r"\bmodel confidence\b"],
            "Risk score": [r"\brisk score\b", r"\brisk level\b", r"\bmy risk\b", r"\bdementia risk\b"],
            "Recommendations": [r"\brecommendations\b", r"\bdoctor recommendations\b", r"\bnext steps\b", r"\blifestyle advice\b"],
            "Previous scans": [r"\bprevious scans\b", r"\bold scans\b", r"\bother scans\b", r"\bscan list\b"],
            "Export PDF": [r"\bexport pdf\b", r"\bdownload pdf\b", r"\bpdf report\b", r"\bpdf download\b"],
            "Patient profile": [r"\bpatient profile\b", r"\bmy profile\b", r"\bprofile info\b", r"\bmy details\b"],
            "Recent activity": [r"\brecent activity\b", r"\bmy activity\b", r"\brecent scans\b"]
        }

        for intent, patterns in db_patterns.items():
            if any(re.search(pat, normalized) for pat in patterns):
                return f"Database:{intent}"

        # 5. Offline FAQ questions
        clean_words = set(re.findall(r'\b\w+\b', normalized))
        for faq_q in FAQ_KB.keys():
            faq_words = set(re.findall(r'\b\w+\b', faq_q.lower()))
            intersection = clean_words.intersection(faq_words)
            if len(intersection) >= len(faq_words) * 0.8:
                return "FAQ"

        # 6. Offline Medical definition topics
        for kb_topic in MEDICAL_KB.keys():
            if kb_topic in normalized:
                return "Medical KB"

        return "General Conversation"

    @classmethod
    def handle_local_query(cls, message: str, intent: str, user_id: str) -> Tuple[str, str]:
        """
        Processes intent and generates corresponding response and detected language.
        """
        lang = LanguageService.detect_language(message)
        normalized = message.lower().strip()
        disclaimer = LanguageService.get_template(lang, "disclaimer")

        # Conversational greetings, goodbyes, thank you, help
        if intent in ["Greeting", "Goodbye", "Thank You", "Help"]:
            key = intent.lower()
            if key == "thank you":
                key = "thanks"
            text = LanguageService.get_template(lang, key)
            return f"{text}\n\n{disclaimer}", lang

        # Dashboard / menu navigation routes redirection
        if intent.startswith("Navigation:"):
            nav_target = intent.split(":")[-1]
            routing_msg = {
                "English": f"Routing you to the **{nav_target}** workspace layout...",
                "Telugu": f"మిమ్మల్ని **{nav_target}** స్క్రీన్‌కి మళ్లిస్తున్నాము...",
                "Hindi": f"आपको **{nav_target}** स्क्रीन पर भेजा जा रहा है...",
                "Spanish": f"Redirigiéndole al área de **{nav_target}**..."
            }.get(lang, f"Routing you to the **{nav_target}** workspace layout...")
            return f"{routing_msg}\n\n{disclaimer}", lang

        # Static FAQ questions matches
        if intent == "FAQ":
            best_match = None
            best_overlap = 0
            clean_words = set(re.findall(r'\b\w+\b', normalized))
            for faq_q, faq_ans in FAQ_KB.items():
                faq_words = set(re.findall(r'\b\w+\b', faq_q.lower()))
                overlap = len(clean_words.intersection(faq_words))
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_match = faq_ans

            if best_match:
                return f"{best_match}\n\n{disclaimer}", lang

        # Static Medical definitions matches
        if intent == "Medical KB":
            for kb_topic, kb_def in MEDICAL_KB.items():
                if kb_topic in normalized:
                    return f"{kb_def}\n\n{disclaimer}", lang

        # Database queries (patient summaries, risk scores, PDF report generation)
        if intent.startswith("Database:"):
            db_response = PatientDataService.fetch_and_format(intent, user_id)
            return f"{db_response}\n\n{disclaimer}", lang

        return "Sorry, I am unable to process this request locally.", lang
