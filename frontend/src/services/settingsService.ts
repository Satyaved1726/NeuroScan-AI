import { apiClient, ApiError } from './apiClient';

export interface UserSettings {
  theme: string;
  language: string;
  assistant_language: string;
  voice_enabled: boolean;
  speech_rate: number;
  notifications: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  high_contrast: boolean;
  font_size: string;
}

export async function fetchUserSettings(): Promise<UserSettings> {
  try {
    const response = await apiClient.get<UserSettings>('/settings');
    return response.data;
  } catch (error) {
    throw new ApiError('Failed to fetch user settings');
  }
}

export async function updateUserSettings(settings: UserSettings): Promise<UserSettings> {
  try {
    const response = await apiClient.put<UserSettings>('/settings', settings);
    return response.data;
  } catch (error) {
    throw new ApiError('Failed to update user settings');
  }
}
