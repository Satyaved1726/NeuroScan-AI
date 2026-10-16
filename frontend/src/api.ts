import type { ApiScanHistoryItem, ApiScanHistoryPage, ScanHistoryItem } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

function getAuthToken() {
  return localStorage.getItem('neuroscan_token');
}

async function apiRequest<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getAnalysisHistory(): Promise<ScanHistoryItem[]> {
  const history = await apiRequest<ApiScanHistoryItem[] | ApiScanHistoryPage>('/analysis/history');
  const items = Array.isArray(history) ? history : history.items;

  return items.map((item) => ({
    id: item.id,
    scanId: item.scan_id,
    thumbnailUrl: item.thumbnail_url,
    patientName: item.patient_name,
    date: item.date,
    prediction: item.prediction as ScanHistoryItem['prediction'],
    confidence: item.confidence,
    risk: item.risk as ScanHistoryItem['risk'],
    status: item.status,
    reportId: item.report_id,
    reportUrl: item.report_url,
    heatmapUrl: item.heatmap_url,
  }));
}
