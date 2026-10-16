import { ApiError } from '../services/apiClient';

export interface ErrorInfo {
  message: string;
  details?: string;
  status?: number;
  code?: string;
}

/**
 * Normalize various error types into a consistent format
 */
export function normalizeError(error: unknown): ErrorInfo {
  if (error instanceof ApiError) {
    return {
      message: error.message || 'API request failed',
      details: typeof error.details === 'string' ? error.details : undefined,
      status: error.status,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || 'An unexpected error occurred',
    };
  }

  return {
    message: 'An unexpected error occurred',
  };
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: ErrorInfo): string {
  const { status, message, details } = error;
  const lowerMessage = message?.toLowerCase() ?? '';

  // Extract backend detail string if provided
  let detailMessage = '';
  if (typeof details === 'string') {
    detailMessage = details;
  } else if (typeof details === 'object' && details !== null) {
    if ('detail' in details && typeof (details as any).detail === 'string') {
      detailMessage = (details as any).detail;
    } else if ('message' in details && typeof (details as any).message === 'string') {
      detailMessage = (details as any).message;
    }
  }

  // If backend provided a specific validation or business error, return it
  if (detailMessage && (status === 400 || status === 409 || status === 422)) {
    return detailMessage;
  }

  // Network and timeout errors
  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('abort') ||
    lowerMessage.includes('econnaborted') ||
    status === 408
  ) {
    return 'Server request timed out. If the service was sleeping, it is waking up—please try again.';
  }

  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('offline') ||
    status === 0
  ) {
    return 'Unable to connect to server. Please check your internet connection.';
  }

  // Intercept database/SQL errors
  if (
    lowerMessage.includes('undefinedcolumn') ||
    lowerMessage.includes('relation') ||
    lowerMessage.includes('sql') ||
    lowerMessage.includes('postgres') ||
    lowerMessage.includes('supabase') ||
    lowerMessage.includes('database') ||
    lowerMessage.includes('db_')
  ) {
    return 'Database temporarily unavailable. Please try again shortly.';
  }

  // Intercept AI model errors
  if (
    lowerMessage.includes('tensorflow') ||
    lowerMessage.includes('keras') ||
    lowerMessage.includes('inference') ||
    lowerMessage.includes('model') ||
    lowerMessage.includes('gradcam')
  ) {
    return 'AI analysis service temporarily busy. Please try again shortly.';
  }

  if (status === 401) {
    if (lowerMessage.includes('credentials') || lowerMessage.includes('invalid') || lowerMessage.includes('not found')) {
      return detailMessage || message;
    }
    return 'Session expired. Please login again.';
  }

  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }

  if (status === 404) {
    return detailMessage || 'The requested resource was not found.';
  }

  if (status === 409) {
    return detailMessage || 'This record already exists or there is a conflict.';
  }

  if (status === 422) {
    return detailMessage || 'The provided data is invalid. Please check your input.';
  }

  if (status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return 'Server temporarily unavailable. Please try again in a moment.';
  }

  return message && !lowerMessage.includes('api request failed')
    ? message
    : 'An unexpected error occurred. Please try again.';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: ErrorInfo): boolean {
  const { status } = error;
  // Retry on: 408 (timeout), 429 (rate limit), 500, 502, 503, 504
  return typeof status === 'number' && [408, 429, 500, 502, 503, 504].includes(status);
}
