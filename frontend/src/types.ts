export type Role = 'User' | 'Doctor' | 'Admin';

export type PredictionLabel =
  | 'Non Demented'
  | 'Very Mild Demented'
  | 'Mild Demented'
  | 'Moderate Demented'
  | 'NonDemented'
  | 'VeryMildDemented'
  | 'MildDemented'
  | 'ModerateDemented';

export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

export type ScanHistoryItem = {
  id: string;
  scanId: string;
  thumbnailUrl?: string;
  patientName?: string;
  date: string;
  prediction: PredictionLabel;
  confidence: number;
  risk: RiskLevel;
  status?: string;
  reportId: string;
  reportUrl?: string;
  heatmapUrl?: string;
};

export type ApiScanHistoryItem = {
  id: string;
  scan_id: string;
  thumbnail_url?: string;
  patient_name?: string;
  date: string;
  prediction: string;
  confidence: number;
  risk: string;
  status?: string;
  report_id: string;
  report_url?: string;
  heatmap_url?: string;
};

export type HistorySortBy = 'date' | 'patient' | 'prediction' | 'confidence' | 'risk' | 'status' | 'report';
export type SortDirection = 'asc' | 'desc';

export type ScanHistoryPage = {
  items: ScanHistoryItem[];
  total: number;
  limit: number;
  offset: number;
};

export type ApiScanHistoryPage = {
  items: ApiScanHistoryItem[];
  total: number;
  limit: number;
  offset: number;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  joinDate: string;
  totalScans: number;
};

export type PatientProfile = {
  id: string;
  user_id: string;
  patient_id: string;
  full_name: string;
  gender?: string | null;
  dob?: string | null;
  age?: number | null;
  phone?: string | null;
  email?: string | null;
  blood_group?: string | null;
  height?: number | null;
  weight?: number | null;
  allergies?: string | null;
  medications?: string | null;
  medical_history?: string | null;
  family_history?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  photo_url?: string | null;
  photo_storage_path?: string | null;
  created_at: string;
  updated_at: string;
};

export type PatientProfilePayload = Omit<
  PatientProfile,
  'id' | 'user_id' | 'patient_id' | 'photo_url' | 'photo_storage_path' | 'created_at' | 'updated_at'
>;

export interface DoctorApplication {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  license_number: string;
  specialization: string;
  hospital_affiliation: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  notes?: string | null;
}

