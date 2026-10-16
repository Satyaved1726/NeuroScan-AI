import type { AppUser } from '../types';
import {
  apiClient,
  ApiError,
  clearAuthTokens,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './apiClient';

interface ApiUser {
  id: string;
  full_name: string;
  email: string;
  role: AppUser['role'];
  join_date: string;
  total_scans: number;
}

export interface AuthResponse {
  access_token: string;
  user: AppUser;
}

interface ApiAuthResponse {
  access_token: string;
  refresh_token: string;
  user: ApiUser;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  role?: string;
}

function mapUser(user: ApiUser): AppUser {
  return {
    id: user.id,
    name: user.full_name,
    email: user.email,
    role: user.role,
    joinDate: user.join_date,
    totalScans: user.total_scans,
  };
}

function persistAuthResponse(response: ApiAuthResponse): AuthResponse {
  setAccessToken(response.access_token);
  setRefreshToken(response.refresh_token);
  return {
    access_token: response.access_token,
    user: mapUser(response.user),
  };
}

/**
 * Login user with email and password.
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<ApiAuthResponse>('/auth/login', payload);
    return persistAuthResponse(response.data);
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

/**
 * Register new user.
 */
export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<ApiAuthResponse>('/auth/register', payload);
    return persistAuthResponse(response.data);
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

/**
 * Get current authenticated user.
 */
export async function fetchCurrentUser(): Promise<AppUser> {
  try {
    const response = await apiClient.get<ApiUser>('/auth/me');
    return mapUser(response.data);
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

/**
 * Logout user and clear tokens.
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await apiClient.post('/auth/logout', { refresh_token: refreshToken });
    }
  } finally {
    clearAuthTokens();
  }
}

function normalizeAuthError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError('Authentication request failed');
}
