import type { PredictionResult } from '../types/mri-workflow';

export const DASHBOARD_ANALYSIS_COMPLETED_EVENT = 'neuroscan:analysis-completed';

export type AnalysisCompletedDetail = {
  scanId: string;
  reportId?: string;
  prediction?: PredictionResult['label'];
};

export function notifyAnalysisCompleted(detail: AnalysisCompletedDetail) {
  window.dispatchEvent(new CustomEvent<AnalysisCompletedDetail>(DASHBOARD_ANALYSIS_COMPLETED_EVENT, { detail }));
}
