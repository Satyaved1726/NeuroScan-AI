import type { PatientProfile, PatientProfilePayload } from '../types';
import { apiClient, ApiError } from './apiClient';

let inFlightProfilePromise: Promise<PatientProfile | null> | null = null;
let cachedProfile: { data: PatientProfile | null; timestamp: number } | null = null;
const PROFILE_CACHE_TTL_MS = 10000;

export function invalidateProfileCache(): void {
  cachedProfile = null;
  inFlightProfilePromise = null;
}

export async function fetchPatientProfile(options?: { forceRefresh?: boolean } | unknown): Promise<PatientProfile | null> {
  const forceRefresh = Boolean(typeof options === 'object' && options !== null && 'forceRefresh' in options && (options as any).forceRefresh);
  if (!forceRefresh && cachedProfile && Date.now() - cachedProfile.timestamp < PROFILE_CACHE_TTL_MS) {
    return cachedProfile.data;
  }
  if (!forceRefresh && inFlightProfilePromise) {
    return inFlightProfilePromise;
  }

  inFlightProfilePromise = (async () => {
    try {
      const response = await apiClient.get<PatientProfile | null>('/profile');
      cachedProfile = { data: response.data, timestamp: Date.now() };
      return response.data;
    } catch (error) {
      const normalized = normalizeProfileError(error);
      if (normalized.status === 404) {
        cachedProfile = { data: null, timestamp: Date.now() };
        return null;
      }
      throw normalized;
    } finally {
      inFlightProfilePromise = null;
    }
  })();

  return inFlightProfilePromise;
}

export async function createPatientProfile(payload: PatientProfilePayload): Promise<PatientProfile> {
  try {
    const response = await apiClient.post<PatientProfile>('/profile', payload);
    invalidateProfileCache();
    return response.data;
  } catch (error) {
    throw normalizeProfileError(error);
  }
}

export async function updatePatientProfile(payload: Partial<PatientProfilePayload>): Promise<PatientProfile> {
  try {
    const response = await apiClient.put<PatientProfile>('/profile', payload);
    invalidateProfileCache();
    return response.data;
  } catch (error) {
    throw normalizeProfileError(error);
  }
}

export async function deletePatientProfile(): Promise<void> {
  try {
    await apiClient.delete('/profile');
    invalidateProfileCache();
  } catch (error) {
    throw normalizeProfileError(error);
  }
}

export async function uploadPatientProfilePhoto(file: File): Promise<PatientProfile> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await apiClient.post<PatientProfile>('/profile/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    invalidateProfileCache();
    return response.data;
  } catch (error) {
    throw normalizeProfileError(error);
  }
}

export async function deletePatientProfilePhoto(): Promise<PatientProfile> {
  try {
    const response = await apiClient.delete<PatientProfile>('/profile/photo');
    invalidateProfileCache();
    return response.data;
  } catch (error) {
    throw normalizeProfileError(error);
  }
}

function normalizeProfileError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError('Profile service request failed');
}
