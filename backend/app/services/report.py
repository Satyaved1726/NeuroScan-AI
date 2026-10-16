from __future__ import annotations

from io import BytesIO
from urllib.request import urlopen

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
import supabase
from datetime import datetime

from ..core.config import get_settings
from ..models.schemas import AnalysisResult, UserOut

REPORT_TITLE_STYLE = ParagraphStyle(
    'ReportTitle',
    fontName='Helvetica-Bold',
    fontSize=24,
    leading=28,
    textColor=colors.HexColor('#0F4C81'),
)
SECTION_HEADER_STYLE = ParagraphStyle(
    'SectionHeader',
    fontName='Helvetica-Bold',
    fontSize=14,
    leading=18,
    textColor=colors.HexColor('#0F172A'),
)
NORMAL_STYLE = ParagraphStyle(
    'Normal',
    fontName='Helvetica',
    fontSize=10,
    leading=14,
    textColor=colors.HexColor('#1F2937'),
)
SMALL_STYLE = ParagraphStyle(
    'Small',
    fontName='Helvetica',
    fontSize=8,
    leading=10,
    textColor=colors.HexColor('#475569'),
)


def build_pdf_report(
    user: UserOut,
    result: AnalysisResult,
    patient_profile: dict | None = None,
    profile_photo_bytes: bytes | None = None,
    scan_image_bytes: bytes | None = None,
    heatmap_image_bytes: bytes | None = None,
) -> bytes:
    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=24, leftMargin=24, topMargin=24, bottomMargin=24)
    story: list = []

    # Header
    story.append(Paragraph('NeuroScan AI', REPORT_TITLE_STYLE))
    story.append(Paragraph('AI-Powered Dementia Screening Report', NORMAL_STYLE))
    story.append(Spacer(1, 12))

    profile = patient_profile or {}
    patient_name = profile.get('full_name') or user.full_name
    patient_id = profile.get('patient_id') or user.id
    patient_rows = [
        ['Patient Name', patient_name],
        ['Patient ID', patient_id],
        ['Email', profile.get('email') or user.email],
        ['Role', user.role.value if hasattr(user.role, 'value') else str(user.role)],
        ['Age', profile.get('age') or 'Not provided'],
        ['Gender', profile.get('gender') or 'Not provided'],
        ['Blood Group', profile.get('blood_group') or 'Not provided'],
        ['Scan Date', result.timestamp.strftime('%Y-%m-%d %H:%M:%S')],
    ]

    # Patient Information
    story.append(Paragraph('PATIENT INFORMATION', SECTION_HEADER_STYLE))
    patient_info_table = Table(patient_rows, colWidths=[45 * mm, 78 * mm], hAlign='LEFT')
    patient_info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#E2E8F0')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#0F172A')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('INNERGRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#CBD5E1')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
    ]))
    if profile_photo_bytes:
        photo = Image(BytesIO(profile_photo_bytes), width=34 * mm, height=34 * mm)
        photo.hAlign = 'CENTER'
        patient_table_data = [[patient_info_table, photo]]
        patient_table = Table(patient_table_data, colWidths=[128 * mm, 42 * mm], hAlign='LEFT')
    else:
        patient_table = Table([[patient_info_table]], colWidths=[170 * mm], hAlign='LEFT')
    patient_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
    ]))
    story.append(patient_table)
    story.append(Spacer(1, 14))

    # Imaging evidence
    story.append(Paragraph('IMAGING EVIDENCE', SECTION_HEADER_STYLE))
    story.append(Paragraph('Original MRI and Grad-CAM heatmap visualizations are included when available.', NORMAL_STYLE))
    story.append(Spacer(1, 10))

    image_rows: list[list] = []
    captions: list = []
    if scan_image_bytes:
        scan_img = Image(BytesIO(scan_image_bytes), width=85 * mm, height=85 * mm)
        scan_img.hAlign = 'CENTER'
        image_rows.append(scan_img)
        captions.append(Paragraph('Original MRI', SMALL_STYLE))

    if heatmap_image_bytes:
        heatmap_img = Image(BytesIO(heatmap_image_bytes), width=85 * mm, height=85 * mm)
        heatmap_img.hAlign = 'CENTER'
        image_rows.append(heatmap_img)
        captions.append(Paragraph('AI Heatmap', SMALL_STYLE))

    if image_rows:
        table_data = [image_rows, captions]
        image_table = Table(table_data, colWidths=[(170 * mm) / len(image_rows)] * len(image_rows), hAlign='CENTER')
        image_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(image_table)
    else:
        story.append(Paragraph('Imaging files not available in this report.', NORMAL_STYLE))
    story.append(Spacer(1, 14))

    # Results summary block
    story.append(Paragraph('RESULTS', SECTION_HEADER_STYLE))
    result_table = Table(
        [
            ['Prediction', result.prediction],
            ['Confidence', f'{result.confidence:.2f}%'],
            ['Risk Score', f'{result.risk_score} / 100'],
            ['Risk Category', result.risk_category],
        ],
        colWidths=[90 * mm, 80 * mm],
        hAlign='LEFT',
    )
    result_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#0F172A')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('INNERGRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#CBD5E1')),
        ('BOX', (0, 0), (-1, -1), 0.6, colors.HexColor('#94A3B8')),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#E2E8F0')),
    ]))
    story.append(result_table)
    story.append(Spacer(1, 14))

    if result.probabilities:
        story.append(Paragraph('MODEL PROBABILITIES', SECTION_HEADER_STYLE))
        probability_rows = [['Class', 'Probability']]
        probability_rows.extend(
            [class_name, f'{float(probability):.2f}%']
            for class_name, probability in result.probabilities.items()
        )
        probability_table = Table(probability_rows, colWidths=[90 * mm, 80 * mm], hAlign='LEFT')
        probability_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2E8F0')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#0F172A')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('INNERGRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#CBD5E1')),
            ('BOX', (0, 0), (-1, -1), 0.6, colors.HexColor('#94A3B8')),
        ]))
        story.append(probability_table)
        story.append(Spacer(1, 14))

    # Clinical summary
    story.append(Paragraph('CLINICAL SUMMARY', SECTION_HEADER_STYLE))
    story.append(Paragraph(result.explanation or 'Clinical summary is pending for this scan.', NORMAL_STYLE))
    story.append(Spacer(1, 14))

    # Recommendations
    story.append(Paragraph('RECOMMENDATIONS', SECTION_HEADER_STYLE))
    if result.recommendations:
        for category, items in result.recommendations.items():
            story.append(Paragraph(f'<b>{category}</b>', NORMAL_STYLE))
            story.extend(_build_recommendation_paragraphs(items))
    else:
        story.append(Paragraph('Recommendations are pending for this scan.', NORMAL_STYLE))
    story.append(Spacer(1, 12))

    # Fetch doctor notes from database
    doctor_notes = []
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
            ORDER BY n.created_at ASC
            """,
            (result.scan_id,)
        )
        rows = cursor.fetchall()
        for r in rows:
            doctor_notes.append({
                'title': r[0],
                'note': r[1],
                'severity': r[2],
                'doctor_name': r[3],
                'created_at': r[4]
            })
        cursor.close()
        db.return_connection(conn)
    except Exception as e:
        print(f"Error querying doctor notes for PDF: {e}")

    # Clinical Validation Notes Section
    if doctor_notes:
        story.append(Paragraph('CLINICAL VALIDATION & OBSERVATIONS', SECTION_HEADER_STYLE))
        for note in doctor_notes:
            note_time = note['created_at'].strftime('%Y-%m-%d %H:%M:%S') if note['created_at'] else 'N/A'
            note_header = f"<b>{note['title']}</b> - Severity: <i>{note['severity']}</i> (Logged by {note['doctor_name']} on {note_time})"
            story.append(Paragraph(note_header, NORMAL_STYLE))
            story.append(Paragraph(note['note'], NORMAL_STYLE))
            story.append(Spacer(1, 8))
        story.append(Spacer(1, 10))

    # Disclaimer
    story.append(Paragraph('DISCLAIMER', SECTION_HEADER_STYLE))
    story.append(Paragraph(
        'This report is generated by NeuroScan AI as an assistive screening tool. '
        'It does not replace a comprehensive clinical evaluation. '
        'Please review findings with a qualified healthcare professional before making medical decisions.',
        NORMAL_STYLE,
    ))
    story.append(Spacer(1, 14))

    # Signature Box
    story.append(Spacer(1, 10))
    sig_data = [
        ['Assigned Neurologist Signature:', 'Chief Neuro-Radiologist Approval:'],
        ['', ''],
        ['__________________________________', '__________________________________'],
        ['Dr. Sarah Jenkins, MD', 'Clinical AI Reviewer Board']
    ]
    sig_table = Table(sig_data, colWidths=[85 * mm, 85 * mm], hAlign='LEFT')
    sig_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 20),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#475569')),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 14))

    # Technical footer
    story.append(Paragraph('TECHNICAL', SECTION_HEADER_STYLE))
    story.append(Paragraph(
        '- AI analysis performed using the dementia screening model.\n'
        '- Report PDF generated programmatically.\n'
        '- Heatmap and MRI content available through the secured healthcare system.',
        SMALL_STYLE,
    ))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f'Report generated on {result.timestamp.strftime("%Y-%m-%d %H:%M:%S")}', SMALL_STYLE))

    document.build(story)
    buffer.seek(0)
    return buffer.read()


def _build_recommendation_paragraphs(items: list[str]) -> list[Paragraph]:
    if not items:
        return [Paragraph('No recommendations are recorded for this category.', NORMAL_STYLE), Spacer(1, 6)]

    paragraphs: list[Paragraph] = []
    for item in items:
        paragraphs.append(Paragraph(f'• {item}', NORMAL_STYLE))
    paragraphs.append(Spacer(1, 6))
    return paragraphs


def fetch_report_image(url: str | None, *, max_bytes: int = 5 * 1024 * 1024) -> bytes | None:
    if not url:
        return None
    try:
        with urlopen(url, timeout=8) as response:
            content = response.read(max_bytes + 1)
    except Exception:
        return None
    if len(content) > max_bytes:
        return None
    return content


def generate_and_upload_report_task(
    user: UserOut,
    report_id: str,
    analysis_result_dict: dict,
) -> None:
    """Generate the report PDF and upload it to Supabase Storage in the background."""
    import logging
    logger = logging.getLogger(__name__)

    try:
        # Fetch image bytes
        scan_image_bytes = fetch_report_image(analysis_result_dict.get('original_image_url'))
        heatmap_image_bytes = fetch_report_image(analysis_result_dict.get('heatmap_url'))

        # Parse timestamp
        timestamp_val = analysis_result_dict.get('timestamp')
        if isinstance(timestamp_val, str):
            try:
                timestamp = datetime.fromisoformat(timestamp_val.replace('Z', '+00:00'))
            except ValueError:
                timestamp = datetime.now()
        elif isinstance(timestamp_val, datetime):
            timestamp = timestamp_val
        else:
            timestamp = datetime.now()

        # Parse patient profile
        patient_profile = analysis_result_dict.get('patient_profile')

        result = AnalysisResult(
            scan_id=analysis_result_dict.get('scan_id'),
            prediction=analysis_result_dict.get('prediction'),
            confidence=analysis_result_dict.get('confidence'),
            risk_score=analysis_result_dict.get('risk_score'),
            risk_category=analysis_result_dict.get('risk_category'),
            scan_quality=analysis_result_dict.get('scan_quality') or [],
            probabilities=analysis_result_dict.get('probabilities') or {},
            explanation=analysis_result_dict.get('explanation') or analysis_result_dict.get('summary') or "",
            summary=analysis_result_dict.get('summary'),
            recommendations=analysis_result_dict.get('recommendations') or {},
            timestamp=timestamp,
            report_id=report_id,
            original_image_url=analysis_result_dict.get('original_image_url'),
            heatmap_url=analysis_result_dict.get('heatmap_url'),
            model_version=analysis_result_dict.get('model_version'),
            image_quality=analysis_result_dict.get('image_quality'),
            patient_profile=patient_profile,
        )

        # Generate PDF report bytes
        pdf_bytes = build_pdf_report(
            user=user,
            result=result,
            patient_profile=patient_profile,
            scan_image_bytes=scan_image_bytes,
            heatmap_image_bytes=heatmap_image_bytes,
        )

        settings = get_settings()
        client = supabase.create_client(settings.supabase_url, settings.supabase_key)
        storage_path = f'{user.id}/{report_id}.pdf'

        client.storage.from_('reports').upload(
            storage_path,
            pdf_bytes,
            file_options={
                'content-type': 'application/pdf',
                'x-upsert': 'true',
            },
        )
        logger.info(f"Background report PDF generation and upload completed for report_id: {report_id}")

    except Exception as e:
        logger.exception(f"Failed to generate and upload report: {e}")
