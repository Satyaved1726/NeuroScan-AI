import { motion } from 'framer-motion';
import MaterialIcon from './MaterialIcon';

const CheckCircle2 = ({ className }: { className?: string }) => <MaterialIcon name="check_circle" className={className} />;
const AlertCircle = ({ className }: { className?: string }) => <MaterialIcon name="warning" className={className} />;
const Clock = ({ className }: { className?: string }) => <MaterialIcon name="schedule" className={className} />;
const Zap = ({ className }: { className?: string }) => <MaterialIcon name="bolt" className={className} />;
const Brain = ({ className }: { className?: string }) => <MaterialIcon name="neurology" className={className} />;
const TrendingUp = ({ className }: { className?: string }) => <MaterialIcon name="trending_up" className={className} />;
import { useDarkMode } from '../hooks/useDarkMode';
import { PreprocessingStep } from '../types/mri-workflow';

interface PreprocessingScreenProps {
  steps: PreprocessingStep[];
  progress: number;
}

export default function PreprocessingScreen({ steps, progress }: PreprocessingScreenProps) {
  const { isDark } = useDarkMode();

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'processing':
        return <Zap className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-medical-blue/10">
          <Brain className="h-6 w-6 text-medical-blue" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Preprocessing MRI Data
        </h2>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Preparing your scan for advanced analysis
        </p>
      </div>

      {/* Overall Progress */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Overall Progress
          </span>
          <span className="text-lg font-bold text-medical-blue">{progress}%</span>
        </div>
        <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
          <motion.div
            className="h-full bg-gradient-to-r from-medical-blue to-medical-sky"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </motion.div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`rounded-xl p-4 border transition-all ${
              step.status === 'completed'
                ? isDark
                  ? 'bg-emerald-900/20 border-emerald-700/50'
                  : 'bg-emerald-50 border-emerald-200'
                : step.status === 'processing'
                  ? isDark
                    ? 'bg-blue-900/20 border-blue-700/50'
                    : 'bg-blue-50 border-blue-200'
                  : isDark
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-slate-100 border-slate-200'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">{getStepIcon(step.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {step.name}
                    </h3>
                    <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {step.description}
                    </p>
                  </div>
                  {step.duration && (
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {step.duration}s
                      </div>
                    </div>
                  )}
                </div>

                {step.status !== 'completed' && step.status !== 'pending' && (
                  <div className="mt-3">
                    <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                      <motion.div
                        className="h-full bg-gradient-to-r from-medical-blue to-medical-sky"
                        initial={{ width: 0 }}
                        animate={{ width: `${step.progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <div className={`text-xs mt-1 text-right font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {step.progress}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Estimated Time */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className={`rounded-xl p-4 flex items-center gap-3 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
      >
        <Clock className="h-5 w-5 text-medical-blue" />
        <div>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Estimated completion
          </p>
          <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ~{Math.max(1, Math.ceil((100 - progress) / 20))} minutes
          </p>
        </div>
      </motion.div>
    </div>
  );
}
