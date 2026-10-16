# -*- coding: utf-8 -*-
"""
PatientDataService Module.
Directly queries the database for patient profile records, active scans, predictions,
confidence scores, risk scores, recommendations, scan histories, and PDF export details.
"""

import logging
from ..store import get_store

logger = logging.getLogger(__name__)

class PatientDataService:
    @staticmethod
    def fetch_and_format(db_action: str, user_id: str) -> str:
        """
        Retrieves and formats clinical records directly from the database in markdown format.
        """
        store = get_store()
        latest = store.get_latest(user_id)
        profile = store.get_patient_profile(user_id)

        # Remove prefix if present
        if db_action.startswith("Database:"):
            db_action = db_action.split(":")[-1]

        if db_action == "Patient profile":
            if not profile:
                return "⚠️ No clinical profile found. Please complete your profile details in the Settings/Profile page."

            dob_str = profile.get('dob').strftime('%Y-%m-%d') if profile.get('dob') else "N/A"
            return (
                "### 👤 Patient Profile Record\n\n"
                f"| Metric | Details |\n"
                f"| :--- | :--- |\n"
                f"| **Full Name** | {profile.get('full_name', 'N/A')} |\n"
                f"| **Patient ID** | `{profile.get('patient_id', 'N/A')}` |\n"
                f"| **Demographics** | {profile.get('age', 'N/A')} yrs old • {profile.get('gender', 'N/A')} |\n"
                f"| **Date of Birth** | {dob_str} |\n"
                f"| **Blood Group** | {profile.get('blood_group', 'N/A')} |\n"
                f"| **Height / Weight** | {profile.get('height', 'N/A')} cm • {profile.get('weight', 'N/A')} kg |\n"
                f"| **Current Medications** | {profile.get('medications', 'None recorded')} |\n"
                f"| **Allergies** | {profile.get('allergies', 'None recorded')} |"
            )

        if not latest:
            return "🔍 I searched your record but couldn't find any uploaded MRI brain scans. Please upload an MRI scan under the Upload page to generate screening records."

        if db_action in ["Show my MRI", "Latest report"]:
            scan_date = latest.created_at.strftime('%Y-%m-%d %H:%M')
            return (
                "### 🧠 Active Brain MRI Screening\n\n"
                f"* **Report Reference:** `{latest.report_id}`\n"
                f"* **Scan Study ID:** `{latest.scan_id}`\n"
                f"* **Analysis Timestamp:** {scan_date}\n"
                f"* **Dementia Prediction:** **{latest.prediction}**\n"
                f"* **Model Confidence:** {round(float(latest.confidence), 2)}%\n"
                f"* **Risk Score Rating:** {latest.risk_score}/100 ({latest.risk_category})\n\n"
                f"#### Diagnostic Explanation:\n"
                f"{latest.explanation}"
            )

        if db_action in ["Prediction history", "Previous scans"]:
            scans = store.list_history(user_id, limit=5)
            if not scans:
                return "🔍 No previous scan history available."

            rows = []
            for s in scans:
                date_str = s.created_at.strftime('%Y-%m-%d')
                rows.append(f"| {date_str} | `{s.scan_id[:8]}...` | **{s.prediction}** | {round(float(s.confidence), 1)}% | {s.risk_score}/100 |")

            table_content = "\n".join(rows)
            return (
                "### 📂 MRI Screening History\n\n"
                "Here are your latest 5 brain screening evaluations:\n\n"
                "| Date | Scan Ref | Prediction | Confidence | Risk Score |\n"
                "| :--- | :--- | :--- | :--- | :--- |\n" + table_content
            )

        if db_action == "Confidence":
            return (
                "### 📊 Machine Learning Model Confidence\n\n"
                f"For your latest scan (Ref: `{latest.scan_id[:8]}...`), the AI model reported a "
                f"**{round(float(latest.confidence), 2)}% confidence score**.\n\n"
                "> **Note:** This represents the statistical probability assigned by the deep learning classifier to the labeled prediction. It helps evaluate scan clarity and model consensus."
            )

        if db_action == "Risk score":
            return (
                "### ⚠️ Brain Atrophy Risk Assessment\n\n"
                f"* **Risk Score:** **{latest.risk_score}/100**\n"
                f"* **Category Rating:** **{latest.risk_category}**\n\n"
                "This score represents the volumetric reduction of gray matter in crucial neurological regions (such as the hippocampus and temporal lobe) compared to healthy aging controls."
            )

        if db_action == "Recommendations":
            recs = latest.recommendations or {}
            lifestyle = recs.get('lifestyle', [])
            medical = recs.get('medical', [])

            lifestyle_str = "\n".join([f"* {r}" for r in lifestyle]) if lifestyle else "* Maintain regular cardiovascular exercise.\n* Engage in cognitively demanding tasks."
            medical_str = "\n".join([f"* {r}" for r in medical]) if medical else "* Consult with a neurologist for clinical correlation."

            return (
                "### 📋 Personal Supportive Guidelines\n\n"
                "Based on your screening markers, our neurological guidelines advise:\n\n"
                f"#### 🩺 Clinical Action Steps\n{medical_str}\n\n"
                f"#### 🍏 Brain Lifestyle Adjustments\n{lifestyle_str}"
            )

        if db_action in ["Export PDF", "Download PDF"]:
            if latest.report_url:
                return (
                    "### 📄 Export Clinical PDF Report\n\n"
                    f"You can download a print-ready version of your latest screening analysis here:\n\n"
                    f"📥 **[Download PDF Report]({latest.report_url})**"
                )
            else:
                return "⚠️ The PDF report is still being generated or storage is unavailable. Please try again shortly."

        if db_action == "Recent activity":
            history = store.list_chat_history(user_id, limit=3)
            activities = []
            if latest:
                activities.append(f"* MRI Scan uploaded & analyzed on {latest.created_at.strftime('%Y-%m-%d')}")
            for h in history:
                activities.append(f"* Query: \"{h['question'][:40]}...\" resolved on {h['created_at'].strftime('%Y-%m-%d')}")

            return "### ⏰ Recent Activity Logs\n\n" + "\n".join(activities)

        return "⚠️ Unknown database query request."
