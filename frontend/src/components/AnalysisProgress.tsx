import { motion } from 'framer-motion';
import MaterialIcon from './MaterialIcon';

const Activity = ({ className }: { className?: string }) => <MaterialIcon name="analytics" className={className} />;
const Sparkles = ({ className }: { className?: string }) => <MaterialIcon name="psychology" className={className} />;
const TrendingUp = ({ className }: { className?: string }) => <MaterialIcon name="trending_up" className={className} />;
import { useDarkMode } from '../hooks/useDarkMode';
import { AnalysisMetric } from '../types/mri-workflow';

interface AnalysisProgressProps {
  progress: number;
  metrics: AnalysisMetric[];
}

export default function AnalysisProgress({ progress, metrics }: AnalysisProgressProps) {
  const { isDark } = useDarkMode();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'warning':
        return 'text-amber-600 dark:text-amber-400';
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-slate-600 dark:text-slate-400';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'normal':
        return isDark ? 'bg-emerald-900/20' : 'bg-emerald-50';
      case 'warning':
        return isDark ? 'bg-amber-900/20' : 'bg-amber-50';
      case 'critical':
        return isDark ? 'bg-red-900/20' : 'bg-red-50';
      default:
        return isDark ? 'bg-slate-800' : 'bg-slate-50';
    }
  };

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'normal':
        return isDark ? 'border-emerald-700/50' : 'border-emerald-200';
      case 'warning':
        return isDark ? 'border-amber-700/50' : 'border-amber-200';
      case 'critical':
        return isDark ? 'border-red-700/50' : 'border-red-200';
      default:
        return isDark ? 'border-slate-700' : 'border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-medical-teal/10">
          <Sparkles className="h-6 w-6 text-medical-teal animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          AI Analysis in Progress
        </h2>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Computing biomarkers and generating predictions
        </p>
      </div>

      {/* Progress Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Analysis Progress
          </span>
          <span className="text-lg font-bold text-medical-teal">{progress}%</span>
        </div>
        <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
          <motion.div
            className="h-full bg-gradient-to-r from-medical-teal to-medical-sky"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.name}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className={`rounded-xl p-4 border ${getStatusBgColor(metric.status)} ${getStatusBorderColor(metric.status)}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {metric.name}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {metric.value}
                  </span>
                  <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {metric.unit}
                  </span>
                </div>
              </div>
              <div className={`rounded-full p-2 ${getStatusBgColor(metric.status)}`}>
                <Activity className={`h-5 w-5 ${getStatusColor(metric.status)}`} />
              </div>
            </div>

            {metric.status !== 'normal' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={`mt-3 pt-3 border-t text-xs font-medium ${
                  metric.status === 'warning'
                    ? isDark
                      ? 'text-amber-400 border-amber-700/50'
                      : 'text-amber-700 border-amber-200'
                    : isDark
                      ? 'text-red-400 border-red-700/50'
                      : 'text-red-700 border-red-200'
                }`}
              >
                {metric.status === 'warning' ? '⚠️' : '🚨'} {metric.status.toUpperCase()} STATUS
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Processing Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className={`rounded-xl p-4 flex items-start gap-3 ${isDark ? 'bg-blue-900/20 border border-blue-700/50' : 'bg-blue-50 border border-blue-200'}`}
      >
        <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
            Analysis Step {Math.ceil(progress / 20)} of 5
          </p>
          <p className={`text-sm mt-1 ${isDark ? 'text-blue-200/70' : 'text-blue-800/70'}`}>
            {progress < 20
              ? 'Loading model weights...'
              : progress < 40
                ? 'Extracting brain features...'
                : progress < 60
                  ? 'Normalizing biomarkers...'
                  : progress < 80
                    ? 'Calculating risk factors...'
                    : 'Generating final prediction...'}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
