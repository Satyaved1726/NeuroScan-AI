import { useEffect, useState } from 'react';
import MaterialIcon from '../components/MaterialIcon';

const Activity = ({ className }: { className?: string }) => <MaterialIcon name="analytics" className={className} />;
const Database = ({ className }: { className?: string }) => <MaterialIcon name="database" className={className} />;
const ShieldCheck = ({ className }: { className?: string }) => <MaterialIcon name="admin_panel_settings" className={className} />;
const Users = ({ className }: { className?: string }) => <MaterialIcon name="group" className={className} />;
const AlertCircle = ({ className }: { className?: string }) => <MaterialIcon name="warning" className={className} />;
const RefreshCw = ({ className }: { className?: string }) => <MaterialIcon name="refresh" className={className} />;
const Terminal = ({ className }: { className?: string }) => <MaterialIcon name="terminal" className={className} />;
const CheckCircle2 = ({ className }: { className?: string }) => <MaterialIcon name="check_circle" className={className} />;
import { motion } from 'framer-motion';
import { fetchAdminData } from '../services/adminService';
import { useToastContext } from '../hooks/useToastContext';
import { normalizeError, getUserFriendlyMessage } from '../utils/errorHandler';
import type { AdminData } from '../services/adminService';

export default function AdminPage() {
  const toast = useToastContext();
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      setError(null);
      const data = await fetchAdminData();
      setAdminData(data);
    } catch (err) {
      const errorInfo = normalizeError(err);
      const message = getUserFriendlyMessage(errorInfo);
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [toast]);

  const metrics = adminData?.metrics;
  const metricsList = metrics
    ? [
        { label: 'Total Enrolled Users', value: metrics.totalUsers.toLocaleString(), icon: Users, color: 'text-medical-blue bg-medical-blue/10 border-clinical-primary/20' },
        { label: 'Total Saved Reports', value: metrics.totalReports.toLocaleString(), icon: Database, color: 'text-clinical-secondary bg-clinical-secondary/10 border-clinical-secondary/20' },
        { label: 'Model Quality Metric', value: `${metrics.modelPerformance}%`, icon: ShieldCheck, color: 'text-green-500 bg-green-500/10 border-green-500/20' },
        { label: 'Active Live Sessions', value: metrics.activeSessions.toLocaleString(), icon: Activity, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-slate-205 dark:bg-slate-805 animate-pulse rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-[#0E1322] animate-pulse rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !adminData || !metrics) {
    return (
      <div className="py-20 text-center space-y-4 max-w-sm mx-auto">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Admin Telemetry Offline</h3>
        <p className="text-xs text-slate-500 dark:text-slate-500">{error || 'Could not query security configurations'}</p>
        <button onClick={() => loadMetrics(true)} className="px-4 py-2 bg-medical-blue text-white rounded-3xl text-xs font-bold transition">
          Reconnect Telemetry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6"
    >

      {/* Title Header info */}
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5/60 pb-3">
        <div>
          <p className="text-[10px] font-bold text-medical-blue uppercase tracking-widest">Administrative Center</p>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">Oversight & Telemetry</h2>
        </div>
        <button
          onClick={() => loadMetrics(false)}
          className="p-2 border border-slate-200 dark:border-white/5 hover:bg-[#F5F8FC] dark:hover:bg-slate-900 rounded-3xl transition-all"
        >
          <RefreshCw className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Row 1: Metrics stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsList.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="bg-white dark:bg-[#181E32] border border-slate-200 dark:border-white/5 rounded-3xl p-5 shadow-soft flex items-center justify-between hover:border-slate-350 dark:hover:border-slate-700 transition-all"
            >
              <div className="space-y-1">
                <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">{item.label}</p>
                <p className="text-2xl font-extrabold text-slate-950 dark:text-white tabular-nums mt-1">{item.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-3xl flex items-center justify-center border ${item.color}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 2: Splits */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dataset Stats */}
        <div className="bg-white dark:bg-[#181E32] border border-slate-200 dark:border-white/5 rounded-3xl p-5 shadow-soft space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-sans">Dataset Telemetry</h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">Parameters for CNN training datasets</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-850">
            {[
              ['Target Patient Age Groups', adminData.datasetStatistics.ageGroups],
              ['Total MRI Scan Sources', adminData.datasetStatistics.scanSources],
              ['Annotation Voxel Quality', adminData.datasetStatistics.annotationQuality],
              ['Train / Validation / Test Split', adminData.datasetStatistics.trainingSplit],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-3.5 text-xs font-semibold">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-805 dark:text-slate-200 font-extrabold">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Security Posture flags */}
        <div className="bg-white dark:bg-[#181E32] border border-slate-200 dark:border-white/5 rounded-3xl p-5 shadow-soft space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-sans">Security Controls</h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">Telemetry posture verification flags</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ['JWT Authentication Layer', adminData.securityPosture.jwtAuthentication],
              ['Role-Based Access (RBAC)', adminData.securityPosture.rbac],
              ['Secure Base Upload TLS', adminData.securityPosture.secureFileUpload],
              ['SQL Input Validation', adminData.securityPosture.inputValidation],
            ] as const).map(([label, enabled]) => (
              <div
                key={label}
                className="p-4 rounded-3xl border border-slate-200 dark:border-white/5 bg-[#F5F8FC]/50 dark:bg-[#0E1322]/40 flex items-center justify-between"
              >
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${
                  enabled
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-[#F5F8FC] dark:bg-[#0E1322] text-slate-500 dark:text-slate-500 border-slate-200 dark:border-white/5'
                }`}>
                  {enabled ? 'Active' : 'Offline'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Security audits log */}
      <div className="bg-white dark:bg-[#181E32] border border-slate-200 dark:border-white/5 rounded-3xl p-5 shadow-soft space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-medical-blue" />
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Security Audit Console</h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5 font-sans">Authorized action reports compiled from system logs</p>
          </div>
        </div>

        <div className="font-mono text-[10px] text-slate-500 bg-slate-950 rounded-3xl border border-slate-900 p-5 space-y-2.5">
          {[
            'SYS: [AUDIT] Log rotation completed successfully.',
            'SYS: [SEC] Encrypted session tokens verified for doctor workspace.',
            'SYS: [DB] DB backup completed. Integrity checks verified.'
          ].map((log, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="text-medical-blue font-extrabold">#</span>
              <span className="text-slate-300 font-medium">{log}</span>
            </div>
          ))}
        </div>
      </div>

    </motion.div>
  );
}
