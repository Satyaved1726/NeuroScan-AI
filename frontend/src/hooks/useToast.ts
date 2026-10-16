import { useCallback } from 'react';

interface ToastOptions {
  duration?: number;
  position?: 'top' | 'bottom';
}

interface ToastAPI {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
}

// Temporary in-memory store for toasts - this will be replaced by react-toastify
const toastHandlers: {
  success?: (msg: string, opts?: ToastOptions) => void;
  error?: (msg: string, opts?: ToastOptions) => void;
  info?: (msg: string, opts?: ToastOptions) => void;
  warning?: (msg: string, opts?: ToastOptions) => void;
} = {};

export function registerToastProvider(handlers: typeof toastHandlers) {
  Object.assign(toastHandlers, handlers);
}

export function useToast(): ToastAPI {
  const success = useCallback((message: string, options?: ToastOptions) => {
    toastHandlers.success?.(message, options);
  }, []);

  const error = useCallback((message: string, options?: ToastOptions) => {
    toastHandlers.error?.(message, options);
  }, []);

  const info = useCallback((message: string, options?: ToastOptions) => {
    toastHandlers.info?.(message, options);
  }, []);

  const warning = useCallback((message: string, options?: ToastOptions) => {
    toastHandlers.warning?.(message, options);
  }, []);

  return { success, error, info, warning };
}
