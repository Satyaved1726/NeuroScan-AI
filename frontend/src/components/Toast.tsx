import { useEffect, useState } from 'react';
import MaterialIcon from './MaterialIcon';

const CheckCircle = ({ className }: { className?: string }) => <MaterialIcon name="check_circle" className={className} />;
const AlertCircle = ({ className }: { className?: string }) => <MaterialIcon name="warning" className={className} />;
const Info = ({ className }: { className?: string }) => <MaterialIcon name="info" className={className} />;
const X = ({ className }: { className?: string }) => <MaterialIcon name="close" className={className} />;
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const toastConfig = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50/90 dark:bg-green-950/80 backdrop-blur-md',
    borderColor: 'border-green-200 dark:border-green-800/40',
    textColor: 'text-green-900 dark:text-green-250',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50/90 dark:bg-red-950/80 backdrop-blur-md',
    borderColor: 'border-red-200 dark:border-red-800/40',
    textColor: 'text-red-900 dark:text-red-250',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-amber-50/90 dark:bg-amber-950/80 backdrop-blur-md',
    borderColor: 'border-amber-200 dark:border-amber-800/40',
    textColor: 'text-amber-900 dark:text-amber-250',
    iconColor: 'text-amber-605 dark:text-amber-400',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50/90 dark:bg-slate-900/90 backdrop-blur-md',
    borderColor: 'border-blue-200 dark:border-slate-800/40',
    textColor: 'text-blue-900 dark:text-blue-250',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
};

export function ToastContainer({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const config = toastConfig[toast.type];
  const Icon = config.icon;
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, duration, onRemove]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 80, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', damping: 15, stiffness: 220 }}
      className={`pointer-events-auto flex items-start gap-3 rounded-clinical border px-4 py-3 shadow-lg border-clinical-border ${config.bgColor} ${config.borderColor}`}
    >
      <Icon className={`h-4.5 w-4.5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
      <p className={`text-xs font-bold leading-normal ${config.textColor}`}>{toast.message}</p>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onRemove(toast.id), 200);
        }}
        className={`ml-2 flex-shrink-0 ${config.textColor} hover:opacity-70`}
        title="Dismiss notification"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
