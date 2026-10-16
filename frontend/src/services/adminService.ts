import { apiClient, ApiError } from './apiClient';

export interface AdminMetrics {
  totalUsers: number;
  totalReports: number;
  modelPerformance: number;
  activeSessions: number;
}

export interface DatasetStatistics {
  ageGroups: string;
  scanSources: string;
  annotationQuality: string;
  trainingSplit: string;
}

export interface SecurityPosture {
  jwtAuthentication: boolean;
  rbac: boolean;
  secureFileUpload: boolean;
  inputValidation: boolean;
}

export interface AdminData {
  metrics: AdminMetrics;
  datasetStatistics: DatasetStatistics;
  securityPosture: SecurityPosture;
}

/**
 * Fetch admin dashboard metrics
 */
export async function fetchAdminMetrics(): Promise<AdminMetrics> {
  try {
    const response = await apiClient.get<AdminMetrics>('/admin/metrics');
    return response.data;
  } catch (error) {
    throw normalizeAdminError(error);
  }
}

/**
 * Fetch all admin data at once
 */
export async function fetchAdminData(): Promise<AdminData> {
  try {
    const response = await apiClient.get<AdminData>('/admin');
    return response.data;
  } catch (error) {
    throw normalizeAdminError(error);
  }
}

/**
 * Fetch dataset statistics
 */
export async function fetchDatasetStatistics(): Promise<DatasetStatistics> {
  try {
    const response = await apiClient.get<DatasetStatistics>('/admin/dataset');
    return response.data;
  } catch (error) {
    throw normalizeAdminError(error);
  }
}

/**
 * Fetch security posture
 */
export async function fetchSecurityPosture(): Promise<SecurityPosture> {
  try {
    const response = await apiClient.get<SecurityPosture>('/admin/security');
    return response.data;
  } catch (error) {
    throw normalizeAdminError(error);
  }
}

function normalizeAdminError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError('Failed to fetch admin data');
}
