import { motion } from 'framer-motion';
import MaterialIcon from './MaterialIcon';

const CheckCircle2 = ({ className }: { className?: string }) => <MaterialIcon name="check_circle" className={className} />;
const AlertCircle = ({ className }: { className?: string }) => <MaterialIcon name="warning" className={className} />;
const AlertTriangle = ({ className }: { className?: string }) => <MaterialIcon name="warning" className={className} />;
const Info = ({ className }: { className?: string }) => <MaterialIcon name="info" className={className} />;
import { useDarkMode } from '../hooks/useDarkMode';
import { QualityCheckResult } from '../types/mri-workflow';

interface ValidationResultProps {
  checks: QualityCheckResult[];
  isValidated: boolean;
  validationError: string | null;
  onContinue?: () => void;
  isLoading?: boolean;
}

export default function ValidationResult({
  checks,
  isValidated,
  validationError,
  onContinue,
  isLoading = false,
}: ValidationResultProps) {
  const { isDark } = useDarkMode();

  const getIconForStatus = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-5 w-5 text-clinical-status-normal" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-clinical-status-warning" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-clinical-status-critical" />;
      default:
        return <Info className="h-5 w-5 text-clinical-primary" />;
    }
  };

  const getBackgroundColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'bg-clinical-status-normal/5';
      case 'warning':
        return 'bg-clinical-status-warning/5';
      case 'failed':
        return 'bg-clinical-status-critical/5';
      default:
        return 'bg-clinical-primary/5';
    }
  };

  const getBorderColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'border-clinical-status-normal/20';
      case 'warning':
        return 'border-clinical-status-warning/20';
      case 'failed':
        return 'border-clinical-status-critical/20';
      default:
        return 'border-clinical-primary/20';
    }
  };

  const getTextColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'text-clinical-status-normal';
      case 'warning':
        return 'text-clinical-status-warning';
      case 'failed':
        return 'text-clinical-status-critical';
      default:
        return 'text-clinical-primary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className={`inline-flex items-center justify-center h-12 w-12 rounded-full ${isValidated ? 'bg-clinical-status-normal/10' : 'bg-clinical-status-critical/10'}`}>
          {isValidated ? (
            <CheckCircle2 className="h-6 w-6 text-clinical-status-normal" />
          ) : (
            <AlertCircle className="h-6 w-6 text-clinical-status-critical" />
          )}
        </div>
        <h2 className="text-2xl font-medium text-clinical-ink dark:text-white font-serif">
          {isValidated ? 'Validation Passed' : 'Validation Failed'}
        </h2>
        <p className="text-sm text-clinical-textSecondary">
          {isValidated
            ? 'Your MRI scan meets all quality requirements'
            : 'Please address the validation issues before proceeding'}
        </p>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-clinical p-4 flex items-start gap-3 border border-clinical-status-critical/20 bg-clinical-status-critical/5`}
        >
          <AlertCircle className="h-5 w-5 text-clinical-status-critical flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-clinical-status-critical font-sans">
              Validation Error
            </p>
            <p className="text-xs mt-1 text-clinical-status-critical font-sans font-semibold">
              {validationError}
            </p>
          </div>
        </motion.div>
      )}

      {/* Quality Checks */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-clinical-textSecondary uppercase tracking-wider font-sans">
          Quality Assessment Details
        </h3>
        {checks.map((check, index) => (
          <motion.div
            key={check.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04 }}
            className={`rounded-clinical p-4 border flex items-start gap-4 ${getBackgroundColor(check.status)} ${getBorderColor(check.status)}`}
          >
            <div className="flex-shrink-0 mt-0.5">{getIconForStatus(check.status)}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-clinical-ink dark:text-white font-sans text-xs">
                  {check.label}
                </h4>
                <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-clinical border ${getBackgroundColor(check.severity)} ${getBorderColor(check.severity)} ${getTextColor(check.severity)}`}>
                  {check.severity.toUpperCase()}
                </span>
              </div>
              <p className="text-xs mt-1 text-clinical-textSecondary font-sans font-semibold">
                {check.message}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-clinical p-4 grid grid-cols-3 gap-4 bg-clinical-bgApp dark:bg-[#101827] border border-clinical-border dark:border-[#1E293B]/60"
      >
        {[
          {
            label: 'Passed',
            count: checks.filter((c) => c.status === 'passed').length,
            color: 'text-clinical-status-normal',
          },
          {
            label: 'Warnings',
            count: checks.filter((c) => c.status === 'warning').length,
            color: 'text-clinical-status-warning',
          },
          {
            label: 'Failed',
            count: checks.filter((c) => c.status === 'failed').length,
            color: 'text-clinical-status-critical',
          },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className={`text-2xl font-mono font-semibold ${stat.color}`}>{stat.count}</p>
            <p className="text-[10px] mt-1 text-clinical-textSecondary font-sans uppercase font-semibold">
              {stat.label}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Action Button */}
      {onContinue && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={onContinue}
          disabled={!isValidated || isLoading}
          className={`w-full rounded-clinical font-semibold py-3 transition-all ${
            isValidated && !isLoading
              ? 'bg-clinical-primary text-white hover:bg-clinical-primaryDark cursor-pointer btn-transition shadow-soft font-sans'
              : 'bg-clinical-bgApp text-clinical-textSecondary dark:bg-[#0A0E17] dark:text-slate-600 cursor-not-allowed border border-clinical-border dark:border-[#1E293B]/40 font-sans'
          }`}
        >
          {isLoading ? 'Processing...' : 'Continue to Preprocessing'}
        </motion.button>
      )}

      {/* Info Message */}
      {!isValidated && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-clinical p-4 flex items-start gap-3 bg-clinical-status-warning/5 border border-clinical-status-warning/20"
        >
          <AlertTriangle className="h-5 w-5 text-clinical-status-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-clinical-status-warning font-sans font-semibold">
            Please fix the failed checks before proceeding with analysis. You can try uploading a different image or adjusting the imaging parameters.
          </p>
        </motion.div>
      )}
    </div>
  );
}
