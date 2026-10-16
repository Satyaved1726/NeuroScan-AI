// MRI Workflow Types and Interfaces

export type WorkflowStep =
  | 'idle'
  | 'uploading'
  | 'validating'
  | 'preprocessing'
  | 'analyzing'
  | 'heatmap'
  | 'saving'
  | 'generating'
  | 'success'
  | 'error';

export type ValidationStatus = 'pending' | 'passed' | 'warning' | 'failed';

export interface QualityCheckResult {
  id: string;
  label: string;
  status: ValidationStatus;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface ScanValidation {
  passed: boolean;
  checks: QualityCheckResult[];
  original_filename: string;
}

export interface ScanUploadResponse {
  scanId: string;
  scan_id: string;
  storage_path: string;
  original_image_url: string;
  width: number;
  height: number;
  size_bytes: number;
  mime_type: string;
  validation: ScanValidation;
}

export interface MRIFile {
  name: string;
  size: number;
  type: string;
  preview: string;
  scanId: string | null;
}

export interface PreprocessingStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  duration?: number;
}

export interface AnalysisMetric {
  name: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
}

export interface PredictionResult {
  label:
    | 'Non Demented'
    | 'Very Mild Demented'
    | 'Mild Demented'
    | 'Moderate Demented'
    | 'NonDemented'
    | 'VeryMildDemented'
    | 'MildDemented'
    | 'ModerateDemented';
  confidence: number;
  riskScore: number;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  timestamp: string;
  scanId: string;
  reportId?: string;
  originalImageUrl?: string;
  heatmapUrl?: string;
  summary?: string;
  recommendations?: Record<string, string[]>;
  modelVersion?: string;
  imageQuality?: string;
  probabilities?: Record<string, number>;
  timingMs?: Record<string, number>;
  // Optional patient metadata returned by the backend
  patientName?: string;
  patientId?: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other' | string;
  bloodGroup?: string;
  dateOfScan?: string;
}

export interface HeatmapResult {
  scanId: string;
  prediction: PredictionResult['label'];
  heatmapUrl: string;
  status: 'generated' | string;
}

export interface MRIAnalysisState {
  // File and upload
  file: MRIFile | null;
  uploadProgress: number;
  scanId: string | null;

  // Workflow
  currentStep: WorkflowStep;
  stepProgress: number;

  // Validation
  qualityChecks: QualityCheckResult[];
  isValidated: boolean;
  validationError: string | null;

  // Preprocessing
  preprocessingSteps: PreprocessingStep[];

  // Analysis
  analysisMetrics: AnalysisMetric[];
  analysisProgress: number;

  // Results
  prediction: PredictionResult | null;

  // Error handling
  error: string | null;
  errorDetails: string | null;
}

export interface MRIWorkflowContextType {
  state: MRIAnalysisState;
  uploadFile: (file: File, preview: string) => Promise<void>;
  validateMRI: () => Promise<void>;
  startPreprocessing: () => Promise<void>;
  startAnalysis: () => Promise<void>;
  generatePrediction: () => Promise<PredictionResult>;
  storePrediction: (prediction: PredictionResult) => Promise<string>;
  resetWorkflow: () => void;
  clearError: () => void;
}
