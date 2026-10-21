from datetime import date, datetime
from enum import Enum
import re
from typing import Any, Literal
from pydantic import BaseModel, EmailStr, Field, field_validator


class Role(str, Enum):
    user = 'User'
    doctor = 'Doctor'
    admin = 'Admin'


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=8)
    role: Role = Role.user


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    role: Role
    join_date: datetime
    total_scans: int


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = 'bearer'
    user: UserOut


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class ValidationCheck(BaseModel):
    id: str
    label: str
    status: str
    message: str
    severity: str


class ScanValidation(BaseModel):
    passed: bool
    checks: list[ValidationCheck]
    original_filename: str


class ScanUploadResponse(BaseModel):
    scanId: str
    scan_id: str
    storage_path: str
    original_image_url: str
    width: int
    height: int
    size_bytes: int
    mime_type: str
    validation: ScanValidation


class PatientProfileBase(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    gender: str | None = Field(default=None, max_length=50)
    dob: date | None = None
    age: int | None = Field(default=None, ge=0)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    blood_group: str | None = Field(default=None, max_length=20)
    height: float | None = Field(default=None, ge=0)
    weight: float | None = Field(default=None, ge=0)
    allergies: str | None = None
    medications: str | None = None
    medical_history: str | None = None
    family_history: str | None = None
    emergency_contact_name: str | None = Field(default=None, max_length=255)
    emergency_contact_phone: str | None = Field(default=None, max_length=50)
    photo_url: str | None = None
    photo_storage_path: str | None = Field(default=None, max_length=500)

    @field_validator('phone', 'emergency_contact_phone')
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if value in (None, ''):
            return None
        if not re.fullmatch(r'^\+?[0-9][0-9\s().-]{6,48}$', value):
            raise ValueError('Phone number is invalid')
        return value


class PatientProfileCreate(PatientProfileBase):
    pass


class PatientProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    gender: str | None = Field(default=None, max_length=50)
    dob: date | None = None
    age: int | None = Field(default=None, ge=0)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    blood_group: str | None = Field(default=None, max_length=20)
    height: float | None = Field(default=None, ge=0)
    weight: float | None = Field(default=None, ge=0)
    allergies: str | None = None
    medications: str | None = None
    medical_history: str | None = None
    family_history: str | None = None
    emergency_contact_name: str | None = Field(default=None, max_length=255)
    emergency_contact_phone: str | None = Field(default=None, max_length=50)
    photo_url: str | None = None
    photo_storage_path: str | None = Field(default=None, max_length=500)

    @field_validator('phone', 'emergency_contact_phone')
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if value in (None, ''):
            return None
        if not re.fullmatch(r'^\+?[0-9][0-9\s().-]{6,48}$', value):
            raise ValueError('Phone number is invalid')
        return value


class PatientProfileOut(PatientProfileBase):
    id: str
    user_id: str
    patient_id: str
    created_at: datetime
    updated_at: datetime


class DashboardSummary(BaseModel):
    total_scans: int
    total_patients: int
    dementia_cases: int
    healthy_cases: int
    average_confidence: float
    reports_generated: int
    patient_name: str | None = None
    patient_age: int | None = None
    patient_gender: str | None = None
    patient_blood_group: str | None = None
    monthly_trend: list["DashboardTrendPoint"] = Field(default_factory=list)
    risk_distribution: list["DashboardRiskPoint"] = Field(default_factory=list)
    recent_scans: list["DashboardRecentScan"] = Field(default_factory=list)


class DashboardTrendPoint(BaseModel):
    name: str
    scans: int
    accuracy: float
    average_confidence: float = 0
    average_risk: float = 0
    high_risk: int = 0


class DashboardRiskPoint(BaseModel):
    name: str
    value: int


class DashboardRecentScan(BaseModel):
    id: str
    scan_id: str
    date: datetime
    patient_name: str
    prediction: str | None = None
    confidence: float | None = None
    risk_score: int | None = None
    risk_category: str | None = None
    report_id: str | None = None
    report_url: str | None = None
    heatmap_url: str | None = None


class AnalysisResult(BaseModel):
    scan_id: str
    prediction: str
    confidence: float
    risk_score: int
    risk_category: str
    scan_quality: list[dict[str, str]]
    probabilities: dict[str, float]
    explanation: str
    summary: str | None = None
    recommendations: dict[str, list[str]]
    timestamp: datetime
    report_id: str | None = None
    original_image_url: str | None = None
    heatmap_url: str | None = None
    model_version: str | None = None
    image_quality: str | None = None
    patient_profile: dict[str, str | int | None] | None = None


class AnalysisPredictionResponse(BaseModel):
    scanId: str
    scan_id: str
    prediction: str
    confidence: float
    risk_score: int
    risk_category: str
    probabilities: dict[str, float]
    timestamp: datetime
    report_id: str | None = None
    summary: str | None = None
    recommendations: dict[str, list[str]] = Field(default_factory=dict)
    original_image_url: str | None = None
    heatmap_url: str | None = None
    model_version: str | None = None
    image_quality: str | None = None
    patient_profile: dict[str, str | int | None] | None = None
    timing_ms: dict[str, float] = Field(default_factory=dict)


class HeatmapResponse(BaseModel):
    scanId: str
    prediction: str
    heatmapUrl: str
    status: str


class ChatSessionCreate(BaseModel):
    title: str
    scan_id: str | None = None
    patient_id: str | None = None


class ChatSessionUpdate(BaseModel):
    title: str | None = None
    is_archived: bool | None = None
    is_favorite: bool | None = None
    language: str | None = None


class ChatSessionOut(BaseModel):
    id: str
    title: str
    scan_id: str | None = None
    patient_id: str | None = None
    is_archived: bool = False
    is_favorite: bool = False
    language: str = 'English'
    created_at: datetime
    updated_at: datetime


class ChatMessage(BaseModel):
    message: str
    context: dict[str, Any] | None = None
    language: str = 'English'
    session_id: str | None = None
    file_name: str | None = None
    file_content: str | None = None
    file_type: str | None = None


class ChatHistoryItem(BaseModel):
    id: str
    scanId: str | None = None
    patientId: str | None = None
    sessionId: str | None = None
    question: str
    answer: str | None = None
    language: str | None = None
    responseTime: float | None = None
    model: str | None = None
    tokensUsed: int | None = None
    feedback: bool | None = None
    timestamp: datetime


class ChatResponse(BaseModel):
    answer: str
    safety_note: str
    clinical_explanation: str | None = None
    lifestyle_advice: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    history_item: ChatHistoryItem | None = None


class ScanHistoryItem(BaseModel):
    id: str
    scan_id: str
    thumbnail_url: str | None = None
    patient_name: str | None = None
    date: datetime
    prediction: str
    confidence: float
    risk: str
    status: str | None = None
    report_id: str
    report_url: str | None = None
    heatmap_url: str | None = None


class ScanHistoryPage(BaseModel):
    items: list[ScanHistoryItem]
    total: int
    limit: int
    offset: int


class ReportMeta(BaseModel):
    id: str
    report_id: str
    scan_id: str
    patient_name: str
    prediction: str
    confidence: float
    risk_score: int
    created_at: datetime
    status: str = 'generated'
    report_url: str | None = None
    original_image_url: str | None = None
    heatmap_url: str | None = None


class UserSettingsSchema(BaseModel):
    theme: str
    language: str
    assistant_language: str
    voice_enabled: bool
    speech_rate: float
    notifications: bool
    email_notifications: bool
    push_notifications: bool
    high_contrast: bool
    font_size: str


class DoctorNoteSchema(BaseModel):
    id: str | None = None
    scan_id: str
    doctor_id: str | None = None
    doctor_name: str | None = None
    title: str
    note: str
    severity: str
    created_at: str | None = None


class DoctorPatientAssignmentCreate(BaseModel):
    doctor_id: str
    patient_id: str


class DoctorPatientAssignmentOut(BaseModel):
    id: str
    doctor_id: str
    doctor_name: str | None = None
    patient_id: str
    patient_name: str | None = None
    assigned_by: str | None = None
    status: str = 'Active'
    created_at: datetime


class ClinicalReviewRequest(BaseModel):
    review_status: str = Field(description="'reviewed' or 'requires_retest' or 'awaiting_review'")
    notes: str | None = None


class ClinicalReviewResponse(BaseModel):
    scan_id: str
    review_status: str
    reviewed_by: str
    reviewer_name: str
    reviewed_at: datetime
    notes: str | None = None


class ClinicalQueueItem(BaseModel):
    id: str
    scan_id: str
    patient_id: str
    patient_name: str
    patient_identifier: str
    date: datetime
    prediction: str | None = None
    confidence: float | None = None
    risk_category: str | None = None
    report_id: str | None = None
    report_status: str = 'generated'
    review_status: str = 'awaiting_review'
    assigned_doctor: str | None = None
    reviewer_name: str | None = None
    reviewed_at: datetime | None = None
    review_notes: str | None = None
    original_image_url: str | None = None
    heatmap_url: str | None = None


class PatientWorklistItem(BaseModel):
    patient_id: str
    user_id: str
    full_name: str
    age: int | None = None
    gender: str | None = None
    blood_group: str | None = None
    total_scans: int = 0
    latest_scan_date: datetime | None = None
    latest_prediction: str | None = None
    latest_risk: str | None = None
    review_status: str = 'No Scans'
    assignment_status: str = 'Active'


class DoctorDashboardSummary(BaseModel):
    assigned_patients: int
    scans_awaiting_review: int
    reports_ready: int
    reviewed_scans: int
    failed_scans: int
    urgent_cases: int
    review_queue: list[ClinicalQueueItem] = Field(default_factory=list)
    recent_patients: list[PatientWorklistItem] = Field(default_factory=list)


class DoctorApplicationCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8)
    license_number: str = Field(min_length=3, max_length=100)
    specialization: str = Field(min_length=2, max_length=100)
    hospital_affiliation: str = Field(min_length=2, max_length=255)


class DoctorApplicationOut(BaseModel):
    id: str
    user_id: str
    full_name: str
    email: EmailStr
    license_number: str
    specialization: str
    hospital_affiliation: str
    status: str
    created_at: datetime
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None
    notes: str | None = None


class DoctorApplicationDecision(BaseModel):
    notes: str | None = None

