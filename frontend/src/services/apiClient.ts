import axios, { AxiosError, AxiosInstance } from 'axios';
import { supabase } from '../lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';
const ACCESS_TOKEN_KEY = 'neuroscan_access_token';
const REFRESH_TOKEN_KEY = 'neuroscan_refresh_token';
export const SESSION_EXPIRED_MESSAGE = 'Session expired. Please login again.';
export const AUTH_REQUIRED_MESSAGE = 'Please login to continue.';

let hasDispatchedSessionExpired = false;

export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function accessTokenIsUsable(token: string): boolean {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return false;
    }

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const normalized = normalizedPayload.padEnd(normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4), '=');
    const decoded = JSON.parse(window.atob(normalized));
    return typeof decoded.exp !== 'number' || decoded.exp * 1000 > Date.now() + 5000;
  } catch {
    return false;
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    hasDispatchedSessionExpired = false;
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function setRefreshToken(token: string | null) {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function clearAuthTokens() {
  setAccessToken(null);
  setRefreshToken(null);
}

export function hasAuthToken() {
  const token = getAccessToken();
  return Boolean(token && accessTokenIsUsable(token));
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 60000, // 60s accommodates Render Free container cold start
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await axios.post<{ access_token: string; refresh_token?: string }>(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
      );
      const newAccessToken = response.data.access_token;
      setAccessToken(newAccessToken);
      if (response.data.refresh_token) {
        setRefreshToken(response.data.refresh_token);
      }
      return newAccessToken;
    } catch {
      clearAuthTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function normalizeAxiosError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const details = error.response?.data;
    let message =
      typeof details === 'object' && details !== null && 'detail' in details
        ? (details as any).detail
        : typeof details === 'object' && details !== null && 'message' in details
        ? (details as any).message
        : error.message || 'API request failed';

    if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
      message = 'Request timed out. The server may be warming up—please try again.';
    }

    if (!error.response && error.code !== 'ECONNABORTED') {
      message = 'Unable to reach the server. Please check your internet connection.';
    }

    return new ApiError(message, status, details);
  }

  return new ApiError((error as Error)?.message ?? 'Unknown API error');
}

function expireSession() {
  clearAuthTokens();

  if (hasDispatchedSessionExpired) {
    return;
  }

  hasDispatchedSessionExpired = true;
  sessionStorage.setItem('neuroscan_session_expired_message', SESSION_EXPIRED_MESSAGE);
  window.dispatchEvent(
    new CustomEvent('neuroscan:auth-expired', {
      detail: { message: SESSION_EXPIRED_MESSAGE },
    }),
  );
}

let activeRequests = 0;
function updateLoadingState(delta: number) {
  activeRequests = Math.max(0, activeRequests + delta);
  window.dispatchEvent(
    new CustomEvent('neuroscan:api-loading', {
      detail: { isLoading: activeRequests > 0 },
    })
  );
}



apiClient.interceptors.request.use(
  async (config) => {
    updateLoadingState(1);
    
    // First attempt to get the active Supabase session access token
    let accessToken: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        accessToken = session.access_token;
      }
    } catch {
      // Supabase getSession fallback
    }

    // Fallback to legacy stored token if available
    if (!accessToken) {
      accessToken = getAccessToken();
    }

    const isAuthEndpoint = config.url?.match(/\/auth\/(login|register|refresh|logout)/);

    // If access token is expired and we are using legacy token, try refresh
    if (accessToken && !accessTokenIsUsable(accessToken) && !isAuthEndpoint) {
      accessToken = await refreshAccessToken();
    }

    if (!accessToken && !isAuthEndpoint) {
      updateLoadingState(-1);
      return Promise.reject(new ApiError(AUTH_REQUIRED_MESSAGE, 401));
    }

    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    updateLoadingState(-1);
    return Promise.reject(normalizeAxiosError(error));
  },
);

apiClient.interceptors.response.use(
  (response) => {
    updateLoadingState(-1);
    return response;
  },
  async (error) => {
    updateLoadingState(-1);
    const originalConfig = axios.isAxiosError(error)
      ? error.config
      : undefined;
    const axiosError = normalizeAxiosError(error);

    if (!originalConfig) {
      return Promise.reject(axiosError);
    }

    const status = axiosError.status;
    const isAuthMutation = originalConfig.url?.match(/\/auth\/(login|register|logout)/);

    // If 401 on protected route, attempt a one-time token refresh
    const retryConfig = originalConfig as any;
    if (status === 401 && !isAuthMutation && !retryConfig._hasRetriedAuth) {
      retryConfig._hasRetriedAuth = true;
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        if (originalConfig.headers) {
          originalConfig.headers.Authorization = `Bearer ${refreshedToken}`;
        }
        return apiClient(originalConfig);
      }
      expireSession();
      return Promise.reject(axiosError);
    }

    // Transparent Retry Mechanism strictly for idempotent GET requests on transient network or 502/503/504 errors
    const isGet = originalConfig.method?.toLowerCase() === 'get';
    if (!retryConfig._retryCount) {
      retryConfig._retryCount = 0;
    }

    const isTransient =
      axios.isAxiosError(error) &&
      (error.code === 'ECONNABORTED' || !error.response || [502, 503, 504].includes(error.response?.status));

    if (isGet && isTransient && retryConfig._retryCount < 2) {
      retryConfig._retryCount += 1;
      const delay = Math.pow(2, retryConfig._retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient(originalConfig);
    }

    return Promise.reject(axiosError);
  },
);
