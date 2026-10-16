import { useCallback, useEffect, useState, useMemo } from 'react';
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { useToastContext } from '../hooks/useToastContext';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { useDarkMode } from '../hooks/useDarkMode';
import { useNotifications } from '../contexts/NotificationContext';
import { normalizeError, getUserFriendlyMessage } from '../utils/errorHandler';
import { DASHBOARD_ANALYSIS_COMPLETED_EVENT } from '../events/dashboardEvents';

import EmptyState from '../components/EmptyState';
import MaterialIcon from '../components/MaterialIcon';
import SkeletonLoader from '../components/SkeletonLoader';
import AdminPage from './AdminPage';

import {
  fetchDashboardData,
  fetchDoctorDashboardData,
  fetchClinicalQueue,
  fetchPatientWorklist,
  submitClinicalReview,
  fetchPatientAssignment,
  type DashboardData,
  type DoctorDashboardData,
  type ClinicalQueueItem,
  type PatientWorklistItem,
} from '../services/dashboardService';
import { fetchAnalysisHistory } from '../services/historyService';
import { fetchReportSummaries, openReportPdf, type ReportSummary } from '../services/reportService';
import { fetchPatientProfile } from '../services/profileService';
import { fetchLatestAnalysis } from '../services/mriService';
import type { PatientProfile, ScanHistoryItem } from '../types';
import type { PredictionResult } from '../types/mri-workflow';

const chartColors = ['#006A61', '#3A82F7', '#F59E0B', '#D32F2F'];

function formatPercent(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(value)}%`
    : 'Pending';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success: showSuccessToast, error: showErrorToast } = useToastContext();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { isDark, toggleDarkMode } = useDarkMode();
  const { unreadCount } = useNotifications();

  // Active tab for doctor dashboard
  const [doctorTab, setDoctorTab] = useState<'queue' | 'worklist'>('queue');
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const [doctorSearch, setDoctorSearch] = useState<string>('');

  // Review modal state
  const [selectedScanForReview, setSelectedScanForReview] = useState<ClinicalQueueItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [reviewDecision, setReviewDecision] = useState<'reviewed' | 'requires_retest'>('reviewed');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // User queries
  const { data: patientProfile, isLoading: isPatientProfileLoading } = useQuery<PatientProfile | null>({
    queryKey: ['patientProfile'],
    queryFn: fetchPatientProfile,
    enabled: !!user && user.role === 'User',
  });

  const { data: latestAnalysis, isLoading: isLatestAnalysisLoading } = useQuery<PredictionResult | null>({
    queryKey: ['latestAnalysis'],
    queryFn: fetchLatestAnalysis,
    enabled: !!user && user.role === 'User',
  });

  const { data: userHistory, isLoading: isUserHistoryLoading } = useQuery({
    queryKey: ['userScansHistory'],
    queryFn: () => fetchAnalysisHistory({ limit: 5 }),
    enabled: !!user && user.role === 'User',
  });

  const { data: userReports, isLoading: isUserReportsLoading } = useQuery<ReportSummary[]>({
    queryKey: ['userReports'],
    queryFn: () => fetchReportSummaries({ limit: 5 }),
    enabled: !!user && user.role === 'User',
  });

  const { data: patientAssignment } = useQuery({
    queryKey: ['patientAssignment', user?.id],
    queryFn: () => fetchPatientAssignment(user?.id ?? ''),
    enabled: !!user && user.role === 'User',
  });

  // Doctor queries
  const {
    data: doctorSummary,
    isLoading: isDoctorSummaryLoading,
    error: doctorQueryError,
  } = useQuery<DoctorDashboardData>({
    queryKey: ['doctorDashboardData'],
    queryFn: fetchDoctorDashboardData,
    enabled: !!user && user.role === 'Doctor',
  });

  const { data: clinicalQueue = [], isLoading: isQueueLoading } = useQuery<ClinicalQueueItem[]>({
    queryKey: ['clinicalQueue', queueFilter, doctorSearch],
    queryFn: () => fetchClinicalQueue({ status: queueFilter === 'all' ? undefined : queueFilter, q: doctorSearch || undefined }),
    enabled: !!user && user.role === 'Doctor' && doctorTab === 'queue',
  });

  const { data: patientWorklist = [], isLoading: isWorklistLoading } = useQuery<PatientWorklistItem[]>({
    queryKey: ['patientWorklist', doctorSearch],
    queryFn: () => fetchPatientWorklist(doctorSearch || undefined),
    enabled: !!user && user.role === 'Doctor' && doctorTab === 'worklist',
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['patientProfile'] });
    queryClient.invalidateQueries({ queryKey: ['latestAnalysis'] });
    queryClient.invalidateQueries({ queryKey: ['userScansHistory'] });
    queryClient.invalidateQueries({ queryKey: ['userReports'] });
    queryClient.invalidateQueries({ queryKey: ['patientAssignment'] });
    queryClient.invalidateQueries({ queryKey: ['doctorDashboardData'] });
    queryClient.invalidateQueries({ queryKey: ['clinicalQueue'] });
    queryClient.invalidateQueries({ queryKey: ['patientWorklist'] });
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener(DASHBOARD_ANALYSIS_COMPLETED_EVENT, invalidateAll);
    window.addEventListener('focus', invalidateAll);
    return () => {
      window.removeEventListener(DASHBOARD_ANALYSIS_COMPLETED_EVENT, invalidateAll);
      window.removeEventListener('focus', invalidateAll);
    };
  }, [invalidateAll]);

  const handleOpenReport = async (reportId: string) => {
    try {
      await openReportPdf(reportId);
    } catch (err) {
      const errorInfo = normalizeError(err);
      showErrorToast(getUserFriendlyMessage(errorInfo));
    }
  };

  const handleOpenReviewModal = (scan: ClinicalQueueItem) => {
    setSelectedScanForReview(scan);
    setReviewNotes(scan.review_notes || '');
    setReviewDecision(scan.review_status === 'requires_retest' ? 'requires_retest' : 'reviewed');
  };

  const handleSubmitReview = async () => {
    if (!selectedScanForReview) return;
    setIsSubmittingReview(true);
    try {
      await submitClinicalReview(selectedScanForReview.scan_id, {
        review_status: reviewDecision,
        notes: reviewNotes,
      });
      showSuccessToast(
        reviewDecision === 'reviewed'
          ? 'Scan marked as reviewed and signed by clinician'
          : 'Scan flagged for patient re-test'
      );
      setSelectedScanForReview(null);
      invalidateAll();
    } catch (err) {
      showErrorToast(getUserFriendlyMessage(normalizeError(err)));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // If Admin
  if (user?.role === 'Admin') {
    return <AdminPage />;
  }

  // ----------------------------------------------------
  // USER (PATIENT) DASHBOARD
  // ----------------------------------------------------
  if (user?.role === 'User') {
    const isUserLoading = isPatientProfileLoading || isLatestAnalysisLoading || isUserHistoryLoading;
    if (isUserLoading) {
      return <SkeletonLoader type="dashboard" />;
    }

    const patientName = patientProfile?.full_name || user?.name || user?.email?.split('@')[0] || 'Patient';
    const patientIdentifier = patientProfile?.patient_id || `NSA-${user?.id?.slice(0, 8).toUpperCase()}`;
    const totalScans = userHistory?.total ?? 0;
    const latestScan = userHistory?.items?.[0];
    const latestPrediction = latestScan?.prediction || latestAnalysis?.label || (totalScans > 0 ? 'Analyzing' : 'No Scans');
    const latestConfidence = latestScan?.confidence ?? latestAnalysis?.confidence;
    const latestRisk = latestScan?.risk || latestAnalysis?.riskLevel || 'Low';

    const assignedDoctorName = patientAssignment?.doctor_name;

    const reportsCount = userReports?.length ?? 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="space-y-6 font-sans text-clinical-ink dark:text-white max-w-7xl mx-auto pb-12"
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-[#EEF5FF] via-white to-slate-50 dark:from-[#0B132B] dark:via-[#101E36] dark:to-[#172554] border border-clinical-border dark:border-slate-800 rounded-clinical p-4 sm:p-6 shadow-soft flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest bg-clinical-primary/10 text-clinical-primary border border-clinical-primary/20">
                Patient Portal
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                ID: {patientIdentifier}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold mt-1 text-slate-900 dark:text-white">
              Welcome back, {patientName}
            </h1>
            <p className="text-xs text-clinical-textSecondary mt-0.5 max-w-xl">
              Track your brain MRI analysis records, AI classification heatmaps, and verified diagnostic summaries.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            <button
              onClick={toggleDarkMode}
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme"
            >
              <MaterialIcon name={isDark ? 'light_mode' : 'dark_mode'} className="text-[20px]" />
            </button>

            <button
              onClick={() => navigate('/settings')}
              className="relative p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              title="Notifications and Settings"
              aria-label="Notifications"
            >
              <MaterialIcon name="notifications" className="text-[20px]" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>

            <Link
              to="/analysis"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-clinical-primary hover:bg-[#005c54] text-white font-bold text-xs sm:text-sm rounded-clinical shadow-soft transition"
            >
              <MaterialIcon name="upload_file" className="text-[20px]" />
              New MRI Scan
            </Link>
          </div>
        </div>

        {/* Real KPI Cards Grid */}
        <div className="grid gap-3.5 grid-cols-2 lg:grid-cols-4">
          {/* Total Scans */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">
                Total MRI Scans
              </span>
              <MaterialIcon name="medical_services" className="text-clinical-primary text-[22px]" />
            </div>
            <p className="text-2xl font-black mt-2 text-slate-900 dark:text-white font-mono">
              {totalScans}
            </p>
            <p className="text-[10px] text-clinical-textSecondary mt-1">Verified patient records</p>
          </div>

          {/* Latest Diagnosis */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">
                Latest Prediction
              </span>
              <MaterialIcon name="insights" className="text-blue-500 text-[22px]" />
            </div>
            <p className="text-base sm:text-lg font-black mt-2 text-slate-900 dark:text-white truncate">
              {latestPrediction}
            </p>
            <p className="text-[10px] text-clinical-textSecondary mt-1">
              Confidence: <span className="font-bold text-clinical-primary">{formatPercent(latestConfidence)}</span>
            </p>
          </div>

          {/* Available Reports */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">
                Available Reports
              </span>
              <MaterialIcon name="description" className="text-amber-500 text-[22px]" />
            </div>
            <p className="text-2xl font-black mt-2 text-slate-900 dark:text-white font-mono">
              {reportsCount}
            </p>
            <p className="text-[10px] text-clinical-textSecondary mt-1">Downloadable PDF files</p>
          </div>

          {/* Care Specialist */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">
                Primary Clinician
              </span>
              <MaterialIcon name="badge" className="text-emerald-500 text-[22px]" />
            </div>
            <p className="text-sm sm:text-base font-extrabold mt-2 text-slate-900 dark:text-white truncate">
              {assignedDoctorName || 'Triage Assigned'}
            </p>
            <p className="text-[10px] text-clinical-textSecondary mt-1">
              {assignedDoctorName ? 'Assigned Neurologist' : 'NeuroScan Clinical Desk'}
            </p>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <button
            onClick={() => navigate('/analysis')}
            className="p-3.5 min-h-[48px] border border-clinical-border dark:border-slate-800 rounded-clinical bg-white dark:bg-[#1E293B] hover:border-clinical-primary text-left shadow-soft flex items-center gap-3 group transition"
          >
            <div className="p-2 rounded-full bg-clinical-primary/10 text-clinical-primary group-hover:scale-110 transition-transform">
              <MaterialIcon name="upload" className="text-[20px]" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">New Scan</p>
              <p className="text-[10px] text-clinical-textSecondary">Upload brain MRI</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/reports')}
            className="p-3.5 min-h-[48px] border border-clinical-border dark:border-slate-800 rounded-clinical bg-white dark:bg-[#1E293B] hover:border-clinical-primary text-left shadow-soft flex items-center gap-3 group transition"
          >
            <div className="p-2 rounded-full bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
              <MaterialIcon name="assignment" className="text-[20px]" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">My Reports</p>
              <p className="text-[10px] text-clinical-textSecondary">Signed PDF dossiers</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/history')}
            className="p-3.5 min-h-[48px] border border-clinical-border dark:border-slate-800 rounded-clinical bg-white dark:bg-[#1E293B] hover:border-clinical-primary text-left shadow-soft flex items-center gap-3 group transition"
          >
            <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
              <MaterialIcon name="history" className="text-[20px]" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Scan History</p>
              <p className="text-[10px] text-clinical-textSecondary">Chronological scans</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/assistant')}
            className="p-3.5 min-h-[48px] border border-clinical-border dark:border-slate-800 rounded-clinical bg-white dark:bg-[#1E293B] hover:border-clinical-primary text-left shadow-soft flex items-center gap-3 group transition"
          >
            <div className="p-2 rounded-full bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform">
              <MaterialIcon name="psychology" className="text-[20px]" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Ask JEMMI</p>
              <p className="text-[10px] text-clinical-textSecondary">AI Health Assistant</p>
            </div>
          </button>
        </div>

        {/* Recent Scans Section (Mobile Cards + Desktop Table) */}
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-4 sm:p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent MRI Scans</h2>
              <p className="text-[10px] text-clinical-textSecondary">Your authenticated brain imaging history</p>
            </div>
            <Link
              to="/history"
              className="text-xs font-bold text-clinical-primary hover:underline flex items-center gap-1"
            >
              View All <MaterialIcon name="chevron_right" className="text-[16px]" />
            </Link>
          </div>

          {totalScans === 0 ? (
            <EmptyState
              icon={MaterialIcon}
              title="No MRI Scans Found"
              description="You have not uploaded any brain MRI scans yet. Upload your first scan to receive an AI classification and Grad-CAM report."
              actionLabel="Upload First Scan"
              onAction={() => navigate('/analysis')}
            />
          ) : (
            <>
              {/* Mobile View: Compact Touch Cards (< 768px) */}
              <div className="md:hidden space-y-3">
                {userHistory?.items?.map((item: ScanHistoryItem) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-clinical border border-clinical-border dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        UID: {item.scanId.slice(0, 10).toUpperCase()}...
                      </span>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide border ${
                          item.risk?.toLowerCase() === 'high' || item.risk?.toLowerCase() === 'critical'
                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                            : item.risk?.toLowerCase() === 'moderate' || item.risk?.toLowerCase() === 'medium'
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        }`}
                      >
                        {item.prediction || 'Pending'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-clinical-textSecondary">
                      <span>Date: {new Date(item.date).toLocaleDateString()}</span>
                      <span>Confidence: <strong className="text-clinical-primary">{formatPercent(item.confidence)}</strong></span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 font-semibold">
                        Review: <span className="font-bold text-slate-800 dark:text-slate-300">{item.status || 'Awaiting Review'}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        {item.reportId && (
                          <button
                            onClick={() => handleOpenReport(item.reportId as string)}
                            className="px-2.5 py-1.5 min-h-[36px] bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded text-[11px] font-bold text-slate-800 dark:text-white transition flex items-center gap-1"
                          >
                            <MaterialIcon name="description" className="text-[14px]" /> PDF
                          </button>
                        )}
                        <Link
                          to={`/results/${item.scanId}`}
                          className="px-3 py-1.5 min-h-[36px] bg-clinical-primary hover:bg-[#005c54] text-white rounded text-[11px] font-bold transition flex items-center gap-1"
                        >
                          PACS <MaterialIcon name="chevron_right" className="text-[14px]" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View: Responsive Table (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-clinical-border dark:border-slate-700 text-clinical-textSecondary font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Scan ID</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">AI Prediction</th>
                      <th className="py-2.5 px-3">Confidence</th>
                      <th className="py-2.5 px-3">Clinical Review</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {userHistory?.items?.map((item: ScanHistoryItem) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                          {item.scanId.slice(0, 12).toUpperCase()}...
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                          {new Date(item.date).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                              item.risk?.toLowerCase() === 'high' || item.risk?.toLowerCase() === 'critical'
                                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                : item.risk?.toLowerCase() === 'moderate' || item.risk?.toLowerCase() === 'medium'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            }`}
                          >
                            {item.prediction || 'Pending'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-clinical-primary">
                          {formatPercent(item.confidence)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-semibold">
                          {item.status || 'Awaiting Clinical Review'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {item.reportId && (
                              <button
                                onClick={() => handleOpenReport(item.reportId as string)}
                                className="px-2.5 py-1 text-slate-700 dark:text-slate-300 hover:text-clinical-primary font-bold flex items-center gap-1 transition"
                                title="Open PDF Report"
                              >
                                <MaterialIcon name="description" className="text-[16px]" /> PDF
                              </button>
                            )}
                            <Link
                              to={`/results/${item.scanId}`}
                              className="px-3 py-1 bg-clinical-primary/10 text-clinical-primary hover:bg-clinical-primary hover:text-white font-bold rounded transition flex items-center gap-1"
                            >
                              PACS Viewport <MaterialIcon name="chevron_right" className="text-[14px]" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* My Reports Section */}
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-4 sm:p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Authorized Medical Reports</h2>
              <p className="text-[10px] text-clinical-textSecondary">Cryptographically signed clinical diagnosis PDFs</p>
            </div>
            <Link to="/reports" className="text-xs font-bold text-clinical-primary hover:underline flex items-center gap-1">
              All Reports <MaterialIcon name="chevron_right" className="text-[16px]" />
            </Link>
          </div>

          {reportsCount === 0 ? (
            <p className="text-xs text-clinical-textSecondary py-4 text-center">
              No reports compiled yet. Scans automatically generate diagnostic reports after AI inference.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {userReports?.map((report: ReportSummary) => (
                <div
                  key={report.id}
                  className="p-3.5 border border-clinical-border dark:border-slate-700 rounded-clinical bg-slate-50/40 dark:bg-slate-800/30 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-slate-500">
                        {report.report_id?.slice(0, 12).toUpperCase()}
                      </span>
                      <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                        Ready
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                      {report.prediction}
                    </p>
                    <p className="text-[10px] text-clinical-textSecondary mt-0.5">
                      Date: {new Date(report.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => handleOpenReport(report.report_id)}
                      className="flex-1 py-1.5 min-h-[38px] bg-clinical-primary hover:bg-[#005c54] text-white rounded text-xs font-bold flex items-center justify-center gap-1 transition"
                    >
                      <MaterialIcon name="visibility" className="text-[15px]" /> View
                    </button>
                    <button
                      onClick={() => handleOpenReport(report.report_id)}
                      className="py-1.5 px-3 min-h-[38px] border border-clinical-border dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-xs font-bold flex items-center justify-center transition"
                      title="Download PDF"
                    >
                      <MaterialIcon name="download" className="text-[15px]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // ----------------------------------------------------
  // DOCTOR (CLINICIAN) DASHBOARD
  // ----------------------------------------------------
  if (isDoctorSummaryLoading) {
    return <SkeletonLoader type="dashboard" />;
  }

  const assignedPatients = doctorSummary?.assigned_patients ?? 0;
  const scansAwaiting = doctorSummary?.scans_awaiting_review ?? 0;
  const reportsReady = doctorSummary?.reports_ready ?? 0;
  const reviewedScans = doctorSummary?.reviewed_scans ?? 0;
  const urgentCases = doctorSummary?.urgent_cases ?? 0;
  const failedScans = doctorSummary?.failed_scans ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6 font-sans text-clinical-ink dark:text-white max-w-7xl mx-auto pb-12"
    >
      {/* Clinician Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-clinical-border dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Doctor Workspace
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              Authorized Specialist: Dr. {user?.name || 'Specialist'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black mt-1 text-slate-900 dark:text-white">
            Clinical Triage & Review Console
          </h1>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={toggleDarkMode}
            className="p-2 border border-clinical-border dark:border-slate-700 rounded-clinical hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title="Toggle theme"
          >
            <MaterialIcon name={isDark ? 'light_mode' : 'dark_mode'} className="text-[18px]" />
          </button>
          <button
            onClick={() => invalidateAll()}
            className="p-2 border border-clinical-border dark:border-slate-700 rounded-clinical hover:bg-slate-50 dark:hover:bg-slate-800 text-clinical-primary transition flex items-center gap-1.5 text-xs font-bold"
            title="Refresh clinical queue"
          >
            <MaterialIcon name="refresh" className="text-[18px]" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats (Real Authorized Metrics) */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-3.5 shadow-soft">
          <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary block">
            Assigned Patients
          </span>
          <p className="text-2xl font-black mt-1 text-slate-900 dark:text-white font-mono">
            {assignedPatients}
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-3.5 shadow-soft">
          <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary block">
            Awaiting Review
          </span>
          <p className="text-2xl font-black mt-1 text-amber-500 font-mono">
            {scansAwaiting}
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-3.5 shadow-soft">
          <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary block">
            Reports Ready
          </span>
          <p className="text-2xl font-black mt-1 text-blue-500 font-mono">
            {reportsReady}
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-3.5 shadow-soft">
          <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary block">
            Reviewed Scans
          </span>
          <p className="text-2xl font-black mt-1 text-emerald-500 font-mono">
            {reviewedScans}
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-3.5 shadow-soft">
          <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary block">
            Urgent Cases
          </span>
          <p className="text-2xl font-black mt-1 text-red-500 font-mono">
            {urgentCases}
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-3.5 shadow-soft">
          <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary block">
            Requires Attention
          </span>
          <p className="text-2xl font-black mt-1 text-slate-500 font-mono">
            {failedScans}
          </p>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-3 border-b border-clinical-border dark:border-slate-800">
        <button
          onClick={() => setDoctorTab('queue')}
          className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            doctorTab === 'queue'
              ? 'border-clinical-primary text-clinical-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <MaterialIcon name="checklist" className="text-[18px]" />
          Clinical Review Queue ({clinicalQueue.length})
        </button>

        <button
          onClick={() => setDoctorTab('worklist')}
          className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            doctorTab === 'worklist'
              ? 'border-clinical-primary text-clinical-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <MaterialIcon name="group" className="text-[18px]" />
          Assigned Patients ({patientWorklist.length})
        </button>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <MaterialIcon name="search" className="text-[18px]" />
          </span>
          <input
            type="text"
            placeholder={doctorTab === 'queue' ? 'Search patient name, UID, or prediction...' : 'Search assigned patient worklist...'}
            value={doctorSearch}
            onChange={(e) => setDoctorSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-clinical-primary min-h-[44px]"
          />
        </div>

        {doctorTab === 'queue' && (
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['all', 'awaiting_review', 'prediction_ready', 'report_ready', 'reviewed', 'failed'].map((pill) => (
              <button
                key={pill}
                onClick={() => setQueueFilter(pill)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full border whitespace-nowrap transition min-h-[38px] ${
                  queueFilter === pill
                    ? 'bg-clinical-primary text-white border-clinical-primary'
                    : 'bg-white dark:bg-[#1E293B] text-slate-600 dark:text-slate-300 border-clinical-border dark:border-slate-700 hover:border-clinical-primary'
                }`}
              >
                {pill === 'all'
                  ? 'All Scans'
                  : pill === 'awaiting_review'
                  ? 'Awaiting Review'
                  : pill === 'prediction_ready'
                  ? 'Prediction Ready'
                  : pill === 'report_ready'
                  ? 'Report Ready'
                  : pill === 'reviewed'
                  ? 'Reviewed'
                  : 'Failed / Retest'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab 1: Clinical Review Queue */}
      {doctorTab === 'queue' && (
        <div className="space-y-4">
          {clinicalQueue.length === 0 ? (
            <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-8 text-center">
              <MaterialIcon name="task_alt" className="text-[48px] text-emerald-500 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Review Queue Clear</h3>
              <p className="text-xs text-clinical-textSecondary mt-1">
                No scans matching the selected filter criteria are awaiting clinician sign-off.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View: Compact Cards (< 768px) */}
              <div className="md:hidden space-y-3">
                {clinicalQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] shadow-soft space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {item.patient_name}
                        </p>
                        <p className="font-mono text-[10px] text-slate-500">
                          {item.patient_identifier} • UID: {item.scan_id.slice(0, 8)}...
                        </p>
                      </div>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                          item.risk_category?.toLowerCase() === 'high' || item.risk_category?.toLowerCase() === 'critical'
                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                            : item.risk_category?.toLowerCase() === 'moderate'
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        }`}
                      >
                        {item.prediction || 'Pending'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Acquisition Date</span>
                        <span className="font-semibold">{new Date(item.date).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Confidence</span>
                        <span className="font-bold text-clinical-primary">{formatPercent(item.confidence)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Review Status</span>
                        <span className="font-semibold capitalize">{item.review_status.replace('_', ' ')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Clinician</span>
                        <span className="font-semibold">{item.assigned_doctor || 'Clinic Pool'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => handleOpenReviewModal(item)}
                        className="flex-1 py-2 min-h-[44px] bg-clinical-primary hover:bg-[#005c54] text-white rounded text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <MaterialIcon name="rate_review" className="text-[16px]" /> Review Scan
                      </button>

                      <Link
                        to={`/results/${item.scan_id}`}
                        className="px-3 py-2 min-h-[44px] border border-clinical-border dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-xs font-bold transition flex items-center justify-center gap-1"
                        title="PACS Viewer"
                      >
                        <MaterialIcon name="visibility" className="text-[16px]" /> PACS
                      </Link>

                      {item.report_id && (
                        <button
                          onClick={() => handleOpenReport(item.report_id as string)}
                          className="px-3 py-2 min-h-[44px] border border-clinical-border dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-xs font-bold transition flex items-center justify-center"
                          title="Open PDF Report"
                        >
                          <MaterialIcon name="description" className="text-[16px]" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View: Interactive Table (>= 768px) */}
              <div className="hidden md:block bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical shadow-soft overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-clinical-border dark:border-slate-700 text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Patient</th>
                      <th className="py-3 px-4">Scan Date</th>
                      <th className="py-3 px-4">AI Prediction</th>
                      <th className="py-3 px-4">Confidence</th>
                      <th className="py-3 px-4">Review Status</th>
                      <th className="py-3 px-4">Reviewer</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {clinicalQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 dark:text-white">{item.patient_name}</p>
                          <p className="font-mono text-[10px] text-slate-400">
                            {item.patient_identifier} • {item.scan_id.slice(0, 8)}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {new Date(item.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                              item.risk_category?.toLowerCase() === 'high' || item.risk_category?.toLowerCase() === 'critical'
                                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                : item.risk_category?.toLowerCase() === 'moderate'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            }`}
                          >
                            {item.prediction || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-clinical-primary">
                          {formatPercent(item.confidence)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              item.review_status === 'reviewed'
                                ? 'text-emerald-500'
                                : item.review_status === 'requires_retest'
                                ? 'text-red-500'
                                : 'text-amber-500'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {item.review_status === 'reviewed'
                              ? 'Reviewed'
                              : item.review_status === 'requires_retest'
                              ? 'Retest Required'
                              : 'Awaiting Review'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {item.reviewer_name || item.assigned_doctor || 'Clinic Pool'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenReviewModal(item)}
                              className="px-3 py-1 bg-clinical-primary hover:bg-[#005c54] text-white font-bold rounded text-xs transition flex items-center gap-1"
                            >
                              <MaterialIcon name="rate_review" className="text-[14px]" /> Review
                            </button>
                            <Link
                              to={`/results/${item.scan_id}`}
                              className="p-1 border border-clinical-border dark:border-slate-700 rounded text-slate-600 hover:text-clinical-primary dark:text-slate-300 transition"
                              title="PACS Viewer"
                            >
                              <MaterialIcon name="visibility" className="text-[16px]" />
                            </Link>
                            {item.report_id && (
                              <button
                                onClick={() => handleOpenReport(item.report_id as string)}
                                className="p-1 border border-clinical-border dark:border-slate-700 rounded text-slate-600 hover:text-clinical-primary dark:text-slate-300 transition"
                                title="Open PDF Report"
                              >
                                <MaterialIcon name="description" className="text-[16px]" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Assigned Patient Worklist */}
      {doctorTab === 'worklist' && (
        <div className="space-y-4">
          {patientWorklist.length === 0 ? (
            <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-800 rounded-clinical p-8 text-center">
              <MaterialIcon name="person_search" className="text-[48px] text-slate-400 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">No Assigned Patients</h3>
              <p className="text-xs text-clinical-textSecondary mt-1">
                Patients assigned to your clinical care roster will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {patientWorklist.map((patient) => (
                <div
                  key={patient.user_id}
                  className="p-4 border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] shadow-soft space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {patient.full_name}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400">
                        {patient.patient_id}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {patient.assignment_status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p>
                      Demographics:{' '}
                      <span className="font-semibold">
                        {patient.age ? `${patient.age}y` : 'Age N/A'} • {patient.gender || 'N/A'} • Blood: {patient.blood_group || 'N/A'}
                      </span>
                    </p>
                    <p>
                      Total Scans: <span className="font-mono font-bold">{patient.total_scans}</span>
                    </p>
                    <p>
                      Latest Diagnosis:{' '}
                      <span className="font-semibold text-clinical-primary">
                        {patient.latest_prediction || 'No Scans'}
                      </span>
                    </p>
                    <p>
                      Review Status:{' '}
                      <span className="font-semibold capitalize">
                        {patient.review_status?.replace('_', ' ')}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clinical Review Workspace Modal */}
      <AnimatePresence>
        {selectedScanForReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <MaterialIcon name="verified_user" className="text-clinical-primary text-[20px]" />
                    Clinician Review Workspace
                  </h3>
                  <p className="text-[11px] text-clinical-textSecondary">
                    Patient: {selectedScanForReview.patient_name} ({selectedScanForReview.patient_identifier})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedScanForReview(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <MaterialIcon name="close" className="text-[20px]" />
                </button>
              </div>

              {/* AI Diagnostic Summary Card */}
              <div className="p-3.5 rounded-clinical bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Model Classification
                  </span>
                  <span className="font-mono text-xs font-black text-clinical-primary">
                    Confidence: {formatPercent(selectedScanForReview.confidence)}
                  </span>
                </div>
                <p className="text-base font-extrabold text-slate-900 dark:text-white">
                  {selectedScanForReview.prediction || 'Inference Pending'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Notice: AI output is preliminary and non-diagnostic until reviewed by an authorized neurologist.
                </p>
              </div>

              {/* Review Decision Choice */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Review Decision
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewDecision('reviewed')}
                    className={`p-3 rounded-clinical border text-left flex items-center gap-2.5 transition min-h-[48px] ${
                      reviewDecision === 'reviewed'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <MaterialIcon name="check_circle" className="text-emerald-500 text-[20px]" />
                    <div>
                      <p className="text-xs font-bold">Approve / Reviewed</p>
                      <p className="text-[10px] text-slate-500">Confirms interpretation</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewDecision('requires_retest')}
                    className={`p-3 rounded-clinical border text-left flex items-center gap-2.5 transition min-h-[48px] ${
                      reviewDecision === 'requires_retest'
                        ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 text-red-800 dark:text-red-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <MaterialIcon name="warning" className="text-red-500 text-[20px]" />
                    <div>
                      <p className="text-xs font-bold">Flag for Retest</p>
                      <p className="text-[10px] text-slate-500">Requires repeat MRI</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Clinician Notes Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Clinician Diagnostic Notes & Recommendations
                </label>
                <textarea
                  rows={4}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Record differential diagnosis notes, hippocampal observations, and follow-up clinical instructions..."
                  className="w-full p-3 text-xs border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-clinical-primary"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                {selectedScanForReview.report_id && (
                  <button
                    type="button"
                    onClick={() => handleOpenReport(selectedScanForReview.report_id as string)}
                    className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-clinical-primary flex items-center gap-1.5"
                  >
                    <MaterialIcon name="description" className="text-[16px]" /> View PDF Report
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedScanForReview(null)}
                    className="px-4 py-2 border border-clinical-border dark:border-slate-700 rounded-clinical text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitReview}
                    disabled={isSubmittingReview}
                    className="px-5 py-2 bg-clinical-primary hover:bg-[#005c54] text-white rounded-clinical text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 min-h-[44px]"
                  >
                    {isSubmittingReview ? (
                      'Saving Review...'
                    ) : (
                      <>
                        <MaterialIcon name="save" className="text-[16px]" /> Sign & Save Review
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
