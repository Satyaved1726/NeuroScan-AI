import type {
  ApiScanHistoryItem,
  ApiScanHistoryPage,
  HistorySortBy,
  PredictionLabel,
  RiskLevel,
  ScanHistoryItem,
  ScanHistoryPage,
  SortDirection,
} from '../types';
import { apiClient, ApiError } from './apiClient';

export type HistoryFilters = {
  q?: string;
  prediction?: PredictionLabel | '';
  risk?: RiskLevel | '';
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: HistorySortBy;
  sortDir?: SortDirection;
  limit?: number;
  offset?: number;
};

function mapHistoryItem(item: ApiScanHistoryItem): ScanHistoryItem {
  return {
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
  };
}

export async function fetchAnalysisHistory(filters: HistoryFilters = {}): Promise<ScanHistoryPage> {
  try {
    const response = await apiClient.get<ApiScanHistoryPage | ApiScanHistoryItem[]>('/analysis/history', {
      params: {
        ...(filters.q ? { q: filters.q } : {}),
        ...(filters.prediction ? { prediction: filters.prediction } : {}),
        ...(filters.risk ? { risk: filters.risk } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
        ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
        sort_by: filters.sortBy ?? 'date',
        sort_dir: filters.sortDir ?? 'desc',
        limit: filters.limit ?? 20,
        offset: filters.offset ?? 0,
      },
    });

    if (Array.isArray(response.data)) {
      return {
        items: response.data.map(mapHistoryItem),
        total: response.data.length,
        limit: response.data.length,
        offset: 0,
      };
    }

    return {
      items: response.data.items.map(mapHistoryItem),
      total: response.data.total,
      limit: response.data.limit,
      offset: response.data.offset,
    };
  } catch (error) {
    throw normalizeHistoryError(error);
  }
}

export async function deleteAnalysisHistoryItem(historyId: string): Promise<void> {
  try {
    await apiClient.delete(`/analysis/history/${historyId}`);
  } catch (error) {
    throw normalizeHistoryError(error);
  }
}

function normalizeHistoryError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError('History service request failed');
}
