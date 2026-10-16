import type { PatientProfile, PatientProfilePayload } from '../types';
import { apiClient, ApiError } from './apiClient';

export async function fetchPatientProfile(): Promise<PatientProfile | null> {
  try {
    const response = await apiClient.get<PatientProfile | null>('/profile');
    return response.data;
  } catch (error) {
    const normalized = normalizeProfileError(error);
    if (normalized.status === 404) {
      return null;
    }
    throw normalized;
  }
}

export async function createPatientProfile(payload: PatientProfilePayload): Promise<PatientProfile> {
  try {
    const response = await apiClient.post<PatientProfile>('/profile', payload);
    return response.data;
  } catch (error) {
    throw normalizeProfileError(error);
  }
}

export async function updatePatientProfile(payload: Partial<PatientProfilePayload>): Promise<PatientProfile> {
  try {
    const response = await apiClient.put<PatientProfile>('/profile', payload);
    return response.data;
  } catch (error) {
    throw normalizeProfileError(error);
  }
}

export async function deletePatientProfile(): Promise<void> {
  try {
    await apiClient.delete('/profile');
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
    return response.data;
  } catch (error) {
    throw normalizeProfileError(error);
  }
}

export async function deletePatientProfilePhoto(): Promise<PatientProfile> {
  try {
    const response = await apiClient.delete<PatientProfile>('/profile/photo');
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
