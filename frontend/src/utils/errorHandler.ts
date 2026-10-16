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
  const { status, message } = error;
  const lowerMessage = message?.toLowerCase() ?? '';

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
    return 'Unable to process MRI. Please try again.';
  }

  // Intercept network/timeout errors
  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('abort') ||
    lowerMessage.includes('network') ||
    lowerMessage.includes('axios') ||
    status === 408 ||
    status === 0
  ) {
    return 'Network unavailable. Retrying...';
  }

  // Intercept AI model errors
  if (
    lowerMessage.includes('tensorflow') ||
    lowerMessage.includes('keras') ||
    lowerMessage.includes('inference') ||
    lowerMessage.includes('model') ||
    lowerMessage.includes('gradcam') ||
    lowerMessage.includes('predict')
  ) {
    return 'AI service temporarily unavailable.';
  }

  if (status === 401) {
    if (lowerMessage.includes('credentials') || lowerMessage.includes('invalid') || lowerMessage.includes('not found')) {
      return message;
    }
    return 'Session expired. Please login again.';
  }

  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }

  if (status === 404) {
    return 'The requested resource was not found.';
  }

  if (status === 409) {
    return 'This resource already exists or there is a conflict.';
  }

  if (status === 422) {
    return 'The provided data is invalid. Please check your input.';
  }

  if (status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  if (status === 500) {
    return 'Unable to process MRI. Please try again.';
  }

  if (status === 503) {
    return 'AI service temporarily unavailable.';
  }

  return message || 'An error occurred. Please try again.';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: ErrorInfo): boolean {
  const { status } = error;
  // Retry on: 408 (timeout), 429 (rate limit), 500, 502, 503, 504
  return typeof status === 'number' && [408, 429, 500, 502, 503, 504].includes(status);
}
