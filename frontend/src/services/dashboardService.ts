import { apiClient, ApiError } from './apiClient';

export interface DashboardStats {
  label: string;
  value: string;
  delta: string;
}

export interface ChartDataPoint {
  name: string;
  scans: number;
  accuracy?: number;
  average_confidence: number;
  average_risk: number;
  high_risk: number;
}

export interface RiskDistributionItem {
  name: string;
  value: number;
}

export interface DementiaDemographics {
  label: string;
  percentage: number;
}

export interface DashboardData {
  stats: DashboardStats[];
  monthlyTrend: ChartDataPoint[];
  riskDistribution: RiskDistributionItem[];
  recentScans: RecentScan[];
  dementiaDistribution: DementiaDemographics[];
  patient: DashboardPatient | null;
}

export interface DashboardPatient {
  name?: string | null;
  age?: number | null;
  gender?: string | null;
  bloodGroup?: string | null;
}

export interface RecentScan {
  id: string;
  scan_id: string;
  date: string;
  patient_name: string;
  prediction: string | null;
  confidence: number | null;
  risk_score: number | null;
  risk_category: string | null;
  report_id: string | null;
  report_url?: string;
  heatmap_url?: string;
  row_key: string;
}

interface DashboardSummaryResponse {
  total_scans: number;
  total_patients: number;
  dementia_cases: number;
  healthy_cases: number;
  average_confidence: number;
  reports_generated: number;
  patient_name?: string | null;
  patient_age?: number | null;
  patient_gender?: string | null;
  patient_blood_group?: string | null;
  monthly_trend?: ChartDataPoint[];
  risk_distribution?: RiskDistributionItem[];
  recent_scans?: Omit<RecentScan, 'row_key'>[];
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function toDashboardData(summary: DashboardSummaryResponse): DashboardData {
  const dementiaPercentage = summary.total_scans
    ? Math.round((summary.dementia_cases / summary.total_scans) * 100)
    : 0;
  const healthyPercentage = summary.total_scans
    ? Math.round((summary.healthy_cases / summary.total_scans) * 100)
    : 0;

  const monthlyTrend = (summary.monthly_trend ?? []).map((point) => ({
    ...point,
    average_confidence: point.average_confidence,
    average_risk: point.average_risk,
    high_risk: point.high_risk,
  }));
  const riskDistribution = (summary.risk_distribution ?? []).filter((item) => item.name);
  const recentScans = (summary.recent_scans ?? []).map((scan) => ({
    ...scan,
    report_id: scan.report_id ?? null,
    row_key: scan.id,
  }));

  return {
    stats: [
      {
        label: 'Total MRI scans',
        value: formatNumber(summary.total_scans),
        delta: '',
      },
      {
        label: 'Total patients',
        value: formatNumber(summary.total_patients),
        delta: '',
      },
      {
        label: 'Dementia cases',
        value: formatNumber(summary.dementia_cases),
        delta: '',
      },
      {
        label: 'Healthy cases',
        value: formatNumber(summary.healthy_cases),
        delta: '',
      },
      {
        label: 'Average confidence',
        value: `${summary.average_confidence}%`,
        delta: '',
      },
      {
        label: 'Reports generated',
        value: formatNumber(summary.reports_generated),
        delta: '',
      },
    ],
    monthlyTrend,
    riskDistribution,
    recentScans,
    patient: summary.patient_name || summary.patient_age || summary.patient_gender || summary.patient_blood_group
      ? {
          name: summary.patient_name,
          age: summary.patient_age,
          gender: summary.patient_gender,
          bloodGroup: summary.patient_blood_group,
        }
      : null,
    dementiaDistribution: [
      { label: 'Healthy', percentage: healthyPercentage },
      { label: 'Dementia indicators', percentage: dementiaPercentage },
    ],
  };
}

let inFlightDashboardPromise: Promise<DashboardData> | null = null;
let cachedDashboard: { data: DashboardData; timestamp: number } | null = null;
const DASHBOARD_CACHE_TTL_MS = 15000;

export function invalidateDashboardCache(): void {
  cachedDashboard = null;
  inFlightDashboardPromise = null;
}

/**
 * Fetch dashboard statistics and analytics
 */
export async function fetchDashboardData(options?: { forceRefresh?: boolean } | unknown): Promise<DashboardData> {
  const forceRefresh = Boolean(typeof options === 'object' && options !== null && 'forceRefresh' in options && (options as any).forceRefresh);
  if (!forceRefresh && cachedDashboard && Date.now() - cachedDashboard.timestamp < DASHBOARD_CACHE_TTL_MS) {
    return cachedDashboard.data;
  }
  if (!forceRefresh && inFlightDashboardPromise) {
    return inFlightDashboardPromise;
  }

  inFlightDashboardPromise = (async () => {
    try {
      const response = await apiClient.get<DashboardSummaryResponse>('/dashboard/summary');
      const data = toDashboardData(response.data);
      cachedDashboard = { data, timestamp: Date.now() };
      return data;
    } catch (error) {
      throw normalizeDashboardError(error);
    } finally {
      inFlightDashboardPromise = null;
    }
  })();

  return inFlightDashboardPromise;
}

/**
 * Fetch dashboard statistics only (for quick loads)
 */
export async function fetchDashboardStats(): Promise<DashboardStats[]> {
  try {
    const data = await fetchDashboardData();
    return data.stats;
  } catch (error) {
    throw normalizeDashboardError(error);
  }
}

/**
 * Fetch monthly trend data for charts
 */
export async function fetchMonthlyTrend(): Promise<ChartDataPoint[]> {
  try {
    const data = await fetchDashboardData();
    return data.monthlyTrend;
  } catch (error) {
    throw normalizeDashboardError(error);
  }
}

/**
 * Fetch risk distribution data
 */
export async function fetchRiskDistribution(): Promise<RiskDistributionItem[]> {
  try {
    const data = await fetchDashboardData();
    return data.riskDistribution;
  } catch (error) {
    throw normalizeDashboardError(error);
  }
}

function normalizeDashboardError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError('Failed to fetch dashboard data');
}
