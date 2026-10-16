# -*- coding: utf-8 -*-
"""
Gemini Assistant Context Builder helper.
Rescued from legacy module to compile and prepare clinical context dictionaries
for patients and scans without calling LLMs.
"""

import logging
from typing import Any
from ..models.schemas import UserOut
from ..services.store import get_store

logger = logging.getLogger(__name__)

def _fetch_doctor_notes(scan_id: str | None) -> list[dict[str, Any]]:
    if not scan_id:
        return []
    try:
        from ..core.database import SupabaseDB
        db = SupabaseDB.initialize()
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT n.title, n.note, n.severity, u.full_name, n.created_at
            FROM doctor_notes n
            JOIN users u ON n.doctor_id = u.id
            WHERE n.scan_id = %s
            ORDER BY n.created_at DESC
            """,
            (scan_id,)
        )
        rows = cursor.fetchall()
        notes = []
        for r in rows:
            notes.append({
                'title': r[0],
                'note': r[1],
                'severity': r[2],
                'doctor_name': r[3],
                'created_at': r[4].isoformat() if r[4] else None
            })
        cursor.close()
        db.return_connection(conn)
        return notes
    except Exception as e:
        logger.warning(f"Failed to fetch doctor notes for JEMMI context: {e}")
        return []


def build_assistant_context(user: UserOut, supplied_context: dict[str, Any] | None = None) -> dict[str, Any]:
    store = get_store()
    latest = store.get_latest(user.id)
    profile = store.get_patient_profile(user.id)
    previous_scans = store.list_history(user.id, limit=5, offset=0)

    if supplied_context:
        selected_scan_id = supplied_context.get('scanId')
        selected_analysis = (
            store.get_analysis_by_scan_id(str(selected_scan_id), user.id)
            if selected_scan_id
            else latest
        )
        return _context_from_payload(user, profile, supplied_context, selected_analysis, previous_scans)

    if not latest:
        return _general_assistant_context(user, profile, previous_scans)

    doctor_notes = _fetch_doctor_notes(latest.scan_id)

    return {
        'patient': _patient_context(user, profile),
        'scan': _scan_context(latest),
        'prediction': _prediction_context(latest),
        'analysis': _analysis_context(latest),
        'history': _history_context(previous_scans, current_scan_id=latest.scan_id),
        'doctor_notes': doctor_notes,
        'assistant': _assistant_metadata(),
        'system': _system_metadata(),
    }


def _context_from_payload(
    user: UserOut,
    profile: dict[str, Any] | None,
    supplied_context: dict[str, Any],
    selected_analysis: Any = None,
    previous_scans: list[Any] | None = None,
) -> dict[str, Any]:
    patient = supplied_context.get('patient') if isinstance(supplied_context.get('patient'), dict) else {}
    recommendations = supplied_context.get('recommendations')
    patient_context = _patient_context(user, profile)
    patient_context.update(
        {
            'patient_name': patient.get('name') or patient_context['patient_name'],
            'patient_id': patient.get('id') or patient_context['patient_id'],
            'age': patient.get('age') or patient_context['age'],
            'gender': patient.get('gender') or patient_context['gender'],
            'blood_group': patient.get('bloodGroup') or patient_context['blood_group'],
        }
    )

    scan_context = _scan_context(selected_analysis)
    scan_context.update(
        {
            'scan_id': supplied_context.get('scanId') or scan_context['scan_id'],
            'report_id': supplied_context.get('reportId') or scan_context['report_id'],
            'risk_category': supplied_context.get('riskLevel') or scan_context['risk_category'],
        }
    )

    prediction_context = _prediction_context(selected_analysis)
    prediction_context.update(
        {
            'label': supplied_context.get('prediction') or prediction_context['label'],
            'confidence': supplied_context.get('confidence') or prediction_context['confidence'],
            'risk_score': supplied_context.get('riskScore') or prediction_context['risk_score'],
            'probabilities': supplied_context.get('probabilities') or prediction_context['probabilities'],
        }
    )

    doctor_notes = _fetch_doctor_notes(scan_context['scan_id'])

    return {
        'patient': patient_context,
        'scan': scan_context,
        'prediction': prediction_context,
        'analysis': {
            'explanation': selected_analysis.explanation
            if selected_analysis
            else 'Scan context was supplied by the frontend for this assistant conversation.',
            'recommendations': recommendations
            if isinstance(recommendations, dict)
            else (selected_analysis.recommendations if selected_analysis else {}),
        },
        'history': _history_context(previous_scans or [], current_scan_id=scan_context['scan_id']),
        'doctor_notes': doctor_notes,
        'assistant': _assistant_metadata(),
        'system': _system_metadata(),
    }


def _general_assistant_context(
    user: UserOut,
    profile: dict[str, Any] | None,
    previous_scans: list[Any] | None = None,
) -> dict[str, Any]:
    return {
        'patient': _patient_context(user, profile),
        'scan': {
            'scan_id': None,
            'report_id': None,
            'scan_timestamp': None,
            'risk_category': None,
        },
        'prediction': {
            'label': None,
            'confidence': None,
            'risk_score': None,
            'probabilities': None,
        },
        'analysis': {
            'explanation': 'No MRI analysis is available for this user yet.',
            'recommendations': {},
        },
        'history': _history_context(previous_scans or [], current_scan_id=None),
        'doctor_notes': [],
        'assistant': _assistant_metadata(),
        'system': _system_metadata(),
    }


def _patient_context(user: UserOut, profile: dict[str, Any] | None) -> dict[str, Any]:
    return {
        'patient_name': profile.get('full_name') if profile else user.full_name,
        'patient_id': profile.get('patient_id') if profile else user.id,
        'age': profile.get('age') if profile else None,
        'gender': profile.get('gender') if profile else None,
        'date_of_birth': profile.get('dob').isoformat() if profile and profile.get('dob') else None,
        'blood_group': profile.get('blood_group') if profile else None,
        'height': profile.get('height') if profile else None,
        'weight': profile.get('weight') if profile else None,
        'allergies': profile.get('allergies') if profile else None,
        'medications': profile.get('medications') if profile else None,
        'medical_history': profile.get('medical_history') if profile else None,
        'family_history': profile.get('family_history') if profile else None,
        'emergency_contact': {
            'name': profile.get('emergency_contact_name') if profile else None,
            'phone': profile.get('emergency_contact_phone') if profile else None,
        },
    }


def _scan_context(analysis: Any = None) -> dict[str, Any]:
    return {
        'scan_id': analysis.scan_id if analysis else None,
        'report_id': analysis.report_id if analysis else None,
        'scan_timestamp': analysis.created_at.isoformat() if analysis else None,
        'risk_category': analysis.risk_category if analysis else None,
        'original_image_url': analysis.original_image_url if analysis else None,
        'heatmap_url': analysis.heatmap_url if analysis else None,
    }


def _prediction_context(analysis: Any = None) -> dict[str, Any]:
    return {
        'label': analysis.prediction if analysis else None,
        'diagnosis': analysis.prediction if analysis else None,
        'confidence': round(float(analysis.confidence), 2) if analysis else None,
        'risk_score': int(analysis.risk_score) if analysis else None,
        'risk': {
            'score': int(analysis.risk_score),
            'category': analysis.risk_category,
        }
        if analysis
        else None,
        'probabilities': analysis.probabilities if analysis else None,
    }


def _analysis_context(analysis: Any = None) -> dict[str, Any]:
    return {
        'explanation': analysis.explanation if analysis else None,
        'recommendations': analysis.recommendations if analysis else {},
    }


def _history_context(previous_scans: list[Any], *, current_scan_id: str | None) -> dict[str, Any]:
    return {
        'previous_scans': [
            {
                'scan_id': scan.scan_id,
                'report_id': scan.report_id,
                'scan_timestamp': scan.created_at.isoformat(),
                'prediction': scan.prediction,
                'confidence': round(float(scan.confidence), 2),
                'risk_score': int(scan.risk_score),
                'risk_category': scan.risk_category,
                'is_current_scan': scan.scan_id == current_scan_id,
            }
            for scan in previous_scans
        ],
    }


def _assistant_metadata() -> dict[str, Any]:
    return {
        'capabilities': [
            'Explain general dementia and MRI screening concepts in conservative clinical language.',
            'Explain MRI analysis results when scan context is available.',
            'Support clinician decision-making, not replace it.',
            'Provide practical lifestyle guidance when relevant.',
            'Recommend follow-up actions and specialist review.',
            'Highlight uncertainty and when medical evaluation is required.',
        ],
        'limitations': 'This is an AI screening tool. It is not a definitive medical diagnosis.',
    }


def _system_metadata() -> dict[str, Any]:
    return {
        'model_name': 'dementia_model.keras',
        'model_accuracy': None,
        'response_style': 'conservative clinical support',
    }
