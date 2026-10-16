import { createContext, ReactNode, useState, useCallback, useId, useRef } from 'react';
import { Toast } from '../components/Toast';
import { registerToastProvider } from '../hooks/useToast';

interface ToastOptions {
  duration?: number;
  position?: 'top' | 'bottom';
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string, duration?: number) => string;
  removeToast: (id: string) => void;
  success: (message: string, options?: number | ToastOptions) => void;
  error: (message: string, options?: number | ToastOptions) => void;
  info: (message: string, options?: number | ToastOptions) => void;
  warning: (message: string, options?: number | ToastOptions) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idGenerator = useId();
  const counterRef = useRef(0);

  const addToast = useCallback(
    (type: Toast['type'], message: string, duration?: number): string => {
      const id = `${idGenerator}-${counterRef.current++}`;
      const toast: Toast = { id, type, message, duration };
      setToasts((prev) => [...prev, toast]);
      return id;
    },
    [idGenerator]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getDuration = (options?: number | ToastOptions) =>
    typeof options === 'number' ? options : options?.duration;

  const success = useCallback(
    (message: string, options?: number | ToastOptions) => addToast('success', message, getDuration(options)),
    [addToast]
  );

  const error = useCallback(
    (message: string, options?: number | ToastOptions) => addToast('error', message, getDuration(options)),
    [addToast]
  );

  const info = useCallback(
    (message: string, options?: number | ToastOptions) => addToast('info', message, getDuration(options)),
    [addToast]
  );

  const warning = useCallback(
    (message: string, options?: number | ToastOptions) => addToast('warning', message, getDuration(options)),
    [addToast]
  );

  // Register with the hook for backwards compatibility
  registerToastProvider({ success, error, info, warning });

  const value: ToastContextType = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    warning,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
