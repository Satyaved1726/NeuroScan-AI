import { apiClient, ApiError } from './apiClient';

export interface DoctorNote {
  id?: string;
  scan_id: string;
  doctor_id?: string;
  doctor_name?: string;
  title: string;
  note: string;
  severity: string;
  created_at?: string;
}

export async function fetchDoctorNotes(scanId: string): Promise<DoctorNote[]> {
  try {
    const response = await apiClient.get<DoctorNote[]>(`/notes/${scanId}`);
    return response.data;
  } catch (error) {
    throw new ApiError('Failed to fetch doctor notes');
  }
}

export async function addDoctorNote(
  scanId: string,
  title: string,
  note: string,
  severity: string
): Promise<DoctorNote> {
  try {
    const response = await apiClient.post<DoctorNote>('/notes', {
      scan_id: scanId,
      title,
      note,
      severity,
    });
    return response.data;
  } catch (error) {
    throw new ApiError('Failed to add doctor note');
  }
}
