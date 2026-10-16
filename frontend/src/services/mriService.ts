import { apiClient, ApiError } from './apiClient';
import type { ScanUploadResponse, PredictionResult, QualityCheckResult, HeatmapResult } from '../types/mri-workflow';

export type UploadProgressCallback = (progress: number) => void;

/**
 * Upload an MRI scan file to the backend.
 * The backend validates the file (type, size, resolution, corruption),
 * uploads it to Supabase Storage, stores metadata in the scans table,
 * and returns a ScanUploadResponse with scanId, scan_id, and validation results.
 *
 * Provides real upload progress via the onProgress callback.
 */
export async function uploadMRIScan(
  file: File,
  onProgress?: UploadProgressCallback
): Promise<ScanUploadResponse> {
  const formData = new FormData();
  formData.append('scan_file', file);

  const response = await apiClient.post<ScanUploadResponse>('/mri/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });

  return {
    ...response.data,
    scanId: response.data.scanId ?? response.data.scan_id,
  };
}

interface ApiAnalysisResult {
  scanId?: string;
  scan_id: string;
  prediction: PredictionResult['label'];
  confidence: number;
  risk_score: number;
  risk_category: PredictionResult['riskLevel'];
  probabilities?: Record<string, number>;
  timestamp: string;
  report_id?: string;
  original_image_url?: string;
  heatmap_url?: string;
  summary?: string;
  explanation?: string;
  recommendations?: Record<string, string[]>;
  timing_ms?: Record<string, number>;
  model_version?: string;
  model_name?: string;
  image_quality?: string;
  patient_profile?: {
    patient_name?: string;
    patient_id?: string;
    age?: number;
    gender?: string;
    blood_group?: string;
  } | null;
  patient_name?: string;
  patient_id?: string;
  age?: number;
  gender?: string;
  blood_group?: string;
}

function requireBackendNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiError(`Backend prediction field "${field}" was not returned`);
  }
  return value;
}

function requireBackendString<T extends string>(value: unknown, field: string): T {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(`Backend prediction field "${field}" was not returned`);
  }
  return value as T;
}

function mapAnalysisResult(result: ApiAnalysisResult): PredictionResult {
  const patient = result.patient_profile ?? {};

  return {
    label: requireBackendString<PredictionResult['label']>(result.prediction, 'prediction'),
    confidence: requireBackendNumber(result.confidence, 'confidence'),
    riskScore: requireBackendNumber(result.risk_score, 'risk_score'),
    riskLevel: requireBackendString<PredictionResult['riskLevel']>(result.risk_category, 'risk_category'),
    timestamp: requireBackendString<string>(result.timestamp, 'timestamp'),
    scanId: requireBackendString<string>(result.scanId ?? result.scan_id, 'scan_id'),
    reportId: result.report_id,
    originalImageUrl: result.original_image_url,
    heatmapUrl: result.heatmap_url,
    summary: result.summary ?? result.explanation,
    recommendations: result.recommendations,
    timingMs: result.timing_ms,
    modelVersion: result.model_version ?? result.model_name,
    imageQuality: result.image_quality,
    probabilities: result.probabilities,
    patientName: patient.patient_name ?? result.patient_name,
    patientId: patient.patient_id ?? result.patient_id,
    age: patient.age ?? result.age,
    gender: patient.gender ?? result.gender,
    bloodGroup: patient.blood_group ?? result.blood_group,
    dateOfScan: result.timestamp,
  };
}

export async function uploadAnalysisScan(file: File): Promise<PredictionResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<ApiAnalysisResult>('/analysis/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return mapAnalysisResult(response.data);
  } catch (error) {
    throw normalizeMriError(error);
  }
}

export async function predictMRIScan(scanId: string): Promise<PredictionResult> {
  try {
    const response = await apiClient.post<ApiAnalysisResult>(`/analysis/predict/${scanId}`, undefined, {
      timeout: 120000,
    });
    return mapAnalysisResult(response.data);
  } catch (error) {
    throw normalizeMriError(error);
  }
}

export async function generateHeatmap(scanId: string): Promise<HeatmapResult> {
  try {
    const response = await apiClient.post<HeatmapResult>(`/analysis/heatmap/${scanId}`, undefined, {
      timeout: 45000,
    });
    return response.data;
  } catch (error) {
    throw normalizeMriError(error);
  }
}

export async function fetchLatestAnalysis(): Promise<PredictionResult | null> {
  try {
    const response = await apiClient.get<ApiAnalysisResult | null>('/analysis/latest');
    return response.data ? mapAnalysisResult(response.data) : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw normalizeMriError(error);
  }
}

/**
 * Check if a 422 error from upload contains validation checks
 * and return them if so.
 */
export function extractValidationFromError(error: unknown): QualityCheckResult[] | null {
  if (error instanceof ApiError && error.status === 422 && error.details) {
    const details = error.details as Record<string, unknown>;
    const validation = details?.validation as Record<string, unknown> | undefined;
    if (validation?.checks) {
      return validation.checks as QualityCheckResult[];
    }
  }
  return null;
}

function normalizeMriError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  return new ApiError('MRI service request failed');
}
