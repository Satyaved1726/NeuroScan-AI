import type { PredictionResult } from '../types/mri-workflow';
import { apiClient, ApiError } from './apiClient';

export interface ReportSummary {
  id: string;
  report_id: string;
  scan_id: string;
  patient_name: string;
  prediction: string;
  confidence: number;
  risk_score: number;
  created_at: string;
  status: string;
  report_url?: string;
  original_image_url?: string;
  heatmap_url?: string;
}

export type ReportFilters = {
  search?: string;
  prediction?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

function requireBackendNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiError(`Backend report field "${field}" was not returned`);
  }
  return value;
}

function requireBackendString<T extends string>(value: unknown, field: string): T {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(`Backend report field "${field}" was not returned`);
  }
  return value as T;
}

export async function fetchReport(reportId: string): Promise<PredictionResult & { report_id: string }> {
  try {
    const response = await apiClient.get<{
      scan_id: string;
      prediction: PredictionResult['label'];
      confidence: number;
      risk_score: number;
      risk_category: PredictionResult['riskLevel'];
      probabilities: Record<string, number>;
      explanation: string;
      recommendations: Record<string, string[]>;
      timestamp: string;
      report_id?: string;
      original_image_url?: string;
      heatmap_url?: string;
      summary?: string;
      model_version?: string;
      image_quality?: string;
      // patient metadata
      patient_name?: string;
      patient_id?: string;
      age?: number;
      gender?: string;
      blood_group?: string;
      patient_profile?: {
        patient_name?: string;
        patient_id?: string;
        age?: number;
        gender?: string;
        blood_group?: string;
      } | null;
    }>(`/analysis/result/${reportId}`);
    const patient = response.data.patient_profile ?? {};

    return {
      label: requireBackendString<PredictionResult['label']>(response.data.prediction, 'prediction'),
      confidence: requireBackendNumber(response.data.confidence, 'confidence'),
      riskScore: requireBackendNumber(response.data.risk_score, 'risk_score'),
      riskLevel: requireBackendString<PredictionResult['riskLevel']>(response.data.risk_category, 'risk_category'),
      timestamp: requireBackendString<string>(response.data.timestamp, 'timestamp'),
      scanId: requireBackendString<string>(response.data.scan_id, 'scan_id'),
      reportId: response.data.report_id,
      probabilities: response.data.probabilities,
      originalImageUrl: response.data.original_image_url,
      heatmapUrl: response.data.heatmap_url,
      summary: response.data.summary ?? response.data.explanation,
      recommendations: response.data.recommendations,
      modelVersion: response.data.model_version,
      imageQuality: response.data.image_quality,
      report_id: response.data.report_id ?? reportId,
      // map optional patient info if present
      patientName: patient.patient_name ?? response.data.patient_name,
      patientId: patient.patient_id ?? response.data.patient_id,
      age: patient.age ?? response.data.age,
      gender: patient.gender ?? response.data.gender,
      bloodGroup: patient.blood_group ?? response.data.blood_group,
      dateOfScan: response.data.timestamp,
    };
  } catch (error) {
    throw normalizeReportError(error);
  }
}

export async function downloadReportPdf(reportId?: string): Promise<Blob> {
  try {
    const endpoint = reportId ? `/reports/${reportId}/pdf` : '/reports/latest';
    const response = await apiClient.get<Blob>(endpoint, {
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    throw normalizeReportError(error);
  }
}

function uniqueReports(reports: ReportSummary[]): ReportSummary[] {
  const seen = new Set<string>();
  return reports.filter((report) => {
    const key = report.report_id || report.id;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function fetchReportSummaries(filters: ReportFilters = {}): Promise<ReportSummary[]> {
  try {
    const response = await apiClient.get<ReportSummary[]>('/reports', {
      params: {
        ...(filters.search ? { q: filters.search } : {}),
        ...(filters.prediction ? { prediction: filters.prediction } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
        ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
        limit: filters.limit ?? 20,
        offset: filters.offset ?? 0,
      },
    });
    return uniqueReports(response.data);
  } catch (error) {
    throw normalizeReportError(error);
  }
}

export async function deleteReport(reportRowId: string): Promise<void> {
  try {
    await apiClient.delete(`/reports/${reportRowId}`);
  } catch (error) {
    throw normalizeReportError(error);
  }
}

export async function openReportPdf(reportId: string): Promise<void> {
  const blob = await downloadReportPdf(reportId);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function normalizeReportError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError('Report service request failed');
}
