import { motion, AnimatePresence } from 'framer-motion';
import MaterialIcon from './MaterialIcon';

const AlertTriangle = ({ className }: { className?: string }) => <MaterialIcon name="warning" className={className} />;
const X = ({ className }: { className?: string }) => <MaterialIcon name="close" className={className} />;

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDanger = false,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-6 shadow-xl z-10 space-y-4"
          >
            {/* Close Button */}
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 text-clinical-textSecondary hover:text-clinical-ink dark:hover:text-white transition"
              aria-label="Close"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {/* Content */}
            <div className="flex gap-4 items-start">
              <div className={`p-3 rounded-full shrink-0 ${isDanger ? 'bg-red-50 dark:bg-red-950/30 text-red-500' : 'bg-blue-50 dark:bg-blue-950/30 text-clinical-primary'}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <h3 className="text-sm font-bold text-clinical-ink dark:text-white leading-tight">{title}</h3>
                <p className="text-xs text-clinical-textSecondary leading-normal font-semibold">{message}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-3.5 py-2 border border-clinical-border dark:border-slate-700 bg-white dark:bg-slate-800 text-clinical-textSecondary hover:bg-slate-50 hover:text-clinical-ink dark:hover:bg-slate-750 dark:hover:text-white text-xs font-bold rounded-clinical transition"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`px-3.5 py-2 text-white text-xs font-bold rounded-clinical transition ${
                  isDanger
                    ? 'bg-clinical-status-critical hover:bg-red-700 shadow-soft'
                    : 'bg-clinical-primary hover:bg-blue-600 shadow-soft'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
