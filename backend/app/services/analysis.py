from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from typing import BinaryIO

import numpy as np
from PIL import Image

from ..ai.inference import get_model_service


def _quality_checks(image: Image.Image) -> list[dict[str, str]]:
    grayscale = image.convert('L')
    arr = np.asarray(grayscale, dtype=np.float32)
    blur_score = float(np.var(np.diff(arr, axis=0))) if arr.size else 0.0
    noise_score = float(np.std(arr))
    width, height = image.size

    checks = [
        {
            'label': 'Blur detection',
            'status': 'Pass' if blur_score > 18 else 'Warning',
            'detail': f'Blur score {blur_score:.2f}',
        },
        {
            'label': 'Resolution validation',
            'status': 'Pass' if width >= 512 and height >= 512 else 'Warning',
            'detail': f'{width} x {height}',
        },
        {
            'label': 'Noise detection',
            'status': 'Pass' if noise_score < 92 else 'Review',
            'detail': f'Noise score {noise_score:.2f}',
        },
    ]
    return checks


def analyze_image(file_obj: BinaryIO) -> dict:
    content = file_obj.read()
    if not content:
        raise ValueError('Empty file received')

    try:
        with Image.open(BytesIO(content)) as image:
            quality_checks = _quality_checks(image)
        model_output = get_model_service().predict(content)
    finally:
        del content

    explanation = (
        f'The MRI scan demonstrates imaging patterns associated with {model_output.prediction}. '
        f'The model confidence is {model_output.confidence:.2f}%. '
        f'The estimated risk score is {model_output.risk_score}/100. '
        'Findings should be reviewed with the clinical history and neurological evaluation.'
    )

    recommendations = {
        'Medical': ['Review the AI-assisted result with a qualified clinician.'],
        'Lifestyle': ['Maintain sleep hygiene, vascular risk control, and consistent daily routines.'],
        'Nutrition': ['Discuss a heart-healthy, nutrient-dense diet with the care team.'],
        'Exercise': ['Follow an age-appropriate physical activity plan approved by a clinician.'],
        'Mental Health': ['Monitor mood, sleep, anxiety, and caregiver stress.'],
        'Follow-Up': ['Schedule follow-up based on symptoms, prior imaging, and clinician guidance.'],
    }

    return {
        'prediction': model_output.prediction,
        'confidence': model_output.confidence,
        'risk_score': model_output.risk_score,
        'risk_category': model_output.risk_category,
        'scan_quality': quality_checks,
        'probabilities': model_output.probabilities,
        'explanation': explanation,
        'summary': explanation,
        'recommendations': recommendations,
        'timestamp': datetime.now(timezone.utc),
    }
