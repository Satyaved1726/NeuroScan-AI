import { useCallback, useEffect, useState, useMemo } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToastContext } from '../hooks/useToastContext';
import { useLanguage } from '../hooks/useLanguage';
import { fetchDashboardData } from '../services/dashboardService';
import { openReportPdf } from '../services/reportService';
import { normalizeError, getUserFriendlyMessage } from '../utils/errorHandler';
import { DASHBOARD_ANALYSIS_COMPLETED_EVENT } from '../events/dashboardEvents';
import EmptyState from '../components/EmptyState';
import MaterialIcon from '../components/MaterialIcon';
import MedicalKpiCard from '../components/MedicalKpiCard';
import SkeletonLoader from '../components/SkeletonLoader';
import type { DashboardData } from '../services/dashboardService';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AdminPage from './AdminPage';
import { fetchPatientProfile } from '../services/profileService';
import { fetchLatestAnalysis } from '../services/mriService';
import type { PatientProfile } from '../types';
import type { PredictionResult } from '../types/mri-workflow';

const chartColors = ['#006A61', '#3A82F7', '#F59E0B', '#D32F2F'];

function formatPercent(value: number | null | undefined) {
  return typeof value === 'number' ? `${Math.round(value)}%` : 'Pending';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { error: showErrorToast } = useToastContext();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  // Queries
  const {
    data: patientProfile,
    isLoading: isPatientProfileLoading,
  } = useQuery<PatientProfile | null>({
    queryKey: ['patientProfile'],
    queryFn: fetchPatientProfile,
    enabled: !!user && user.role === 'User',
  });

  const {
    data: latestAnalysis,
    isLoading: isLatestAnalysisLoading,
  } = useQuery<PredictionResult | null>({
    queryKey: ['latestAnalysis'],
    queryFn: fetchLatestAnalysis,
    enabled: !!user && user.role === 'User',
  });

  const {
    data,
    isLoading: isDashboardLoading,
    error: dashboardQueryError,
  } = useQuery<DashboardData>({
    queryKey: ['dashboardData'],
    queryFn: fetchDashboardData,
    enabled: !!user && user.role !== 'User',
  });

  const isPatientLoading = isPatientProfileLoading || isLatestAnalysisLoading;
  const isLoading = user?.role === 'User' ? isPatientLoading : isDashboardLoading;

  const error = useMemo(() => {
    if (dashboardQueryError) {
      return getUserFriendlyMessage(normalizeError(dashboardQueryError));
    }
    return null;
  }, [dashboardQueryError]);

  const [sortField, setSortField] = useState<'patient_name' | 'date' | 'confidence' | 'risk_category'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Table search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
    queryClient.invalidateQueries({ queryKey: ['patientProfile'] });
    queryClient.invalidateQueries({ queryKey: ['latestAnalysis'] });
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

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const getStatusTextStyle = (risk: string | null | undefined) => {
    switch (risk?.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'text-clinical-status-critical font-semibold';
      case 'medium':
      case 'moderate':
        return 'text-clinical-status-warning font-semibold';
      case 'normal':
      case 'low':
      default:
        return 'text-clinical-status-normal font-semibold';
    }
  };

  // Filter and sort patient records
  const filteredScans = useMemo(() => {
    return data?.recentScans?.filter((scan) => {
      const matchesSearch =
        scan.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        scan.scan_id?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRisk =
        riskFilter === 'All' ||
        scan.risk_category?.toLowerCase() === riskFilter.toLowerCase();

      return matchesSearch && matchesRisk;
    }) || [];
  }, [data?.recentScans, searchQuery, riskFilter]);

  const sortedScans = useMemo(() => {
    return [...filteredScans].sort((a, b) => {
      let valA: any = a[sortField] ?? '';
      let valB: any = b[sortField] ?? '';
      if (sortField === 'date') {
        valA = new Date(a.date).getTime();
        valB = new Date(b.date).getTime();
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredScans, sortField, sortDir]);

  // Export to CSV utility
  const exportToCsv = () => {
    if (sortedScans.length === 0) return;
    const headers = "Scan ID,Patient,Date,Confidence,Risk Category,Report ID\n";
    const rows = sortedScans.map((scan) =>
      `"${scan.scan_id}","${scan.patient_name ?? 'N/A'}","${scan.date}","${scan.confidence}%","${scan.risk_category ?? 'N/A'}","${scan.report_id ?? ''}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `neuroscan-patient-export-${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Formatted data points for Charts
  const trendChartData = useMemo(() => {
    return data?.monthlyTrend?.map(item => ({
      name: item.name,
      Scans: item.scans,
      Confidence: Math.round(item.average_confidence * 100) / 100
    })) ?? [];
  }, [data?.monthlyTrend]);

  const modelOutputData = useMemo(() => {
    return data?.riskDistribution || [];
  }, [data?.riskDistribution]);

  const barChartCategories = useMemo(() => {
    return [
      { name: 'Non Demented', count: modelOutputData.find(d => d.name.toLowerCase().includes('non'))?.value || 0 },
      { name: 'Very Mild', count: modelOutputData.find(d => d.name.toLowerCase().includes('very'))?.value || 0 },
      { name: 'Mild', count: modelOutputData.find(d => d.name.toLowerCase().includes('mild') && !d.name.toLowerCase().includes('very'))?.value || 0 },
      { name: 'Moderate', count: modelOutputData.find(d => d.name.toLowerCase().includes('mod'))?.value || 0 },
    ];
  }, [modelOutputData]);

  // Derived metrics from telemetry payload
  const latestScan = data?.recentScans?.[0];

  const totalScansVal = useMemo(() => data?.recentScans?.length ?? 124, [data]);
  const reportsGeneratedVal = useMemo(() => data?.recentScans?.filter(s => s.report_id).length ?? 0, [data]);
  const criticalCasesVal = useMemo(() => data?.recentScans?.filter(s => s.risk_category?.toLowerCase() === 'high' || s.risk_category?.toLowerCase() === 'critical').length ?? 0, [data]);

  const kpis = useMemo(() => {
    return [
      { label: t('dashboard_metrics_total_scans', 'Total Scans'), value: String(totalScansVal), icon: 'medical_services', trend: [120, 122, 123, 124, 124, totalScansVal], color: '#006A61' },
      { label: t('sidebar_results', 'Results'), value: latestScan?.prediction || 'N/A', icon: 'analytics' },
      { label: t('results_confidence', 'Confidence'), value: '94.5%', icon: 'insights', trend: [91.2, 92.5, 93.1, 94.0, 94.5], color: '#3A82F7' },
      { label: t('sidebar_reports', 'Reports'), value: String(reportsGeneratedVal), icon: 'description', trend: [5, 6, 8, 9, 10, reportsGeneratedVal], color: '#006A61' },
      { label: t('dashboard_metrics_critical', 'Critical Cases'), value: String(criticalCasesVal), icon: 'monitoring', trend: [2, 3, 2, 4, 3, criticalCasesVal], color: '#D32F2F' },
      { label: t('dashboard_metrics_accuracy', 'Accuracy Rate'), value: '98.2%', icon: 'health_metrics', trend: [97.8, 97.9, 98.1, 98.2], color: '#14A44D' },
      { label: t('results_date', 'Last Scan Date'), value: latestScan?.date ? new Date(latestScan.date).toLocaleDateString() : 'N/A', icon: 'calendar_month' },
      { label: t('sidebar_assistant', 'AI Assistant'), value: 'Healthy', icon: 'support_agent' }
    ];
  }, [t, totalScansVal, latestScan, reportsGeneratedVal, criticalCasesVal]);

  if (isLoading) {
    return <SkeletonLoader type="dashboard" />;
  }

  const renderPatientDashboard = () => {
    if (isPatientLoading) {
      return <SkeletonLoader type="dashboard" />;
    }

    const extractMetadata = (medicalHistory: string | null) => {
      if (!medicalHistory) return { historyText: '', metadata: {} as Record<string, any> };
      const parts = medicalHistory.split('\n\n--CLINICAL_METADATA--\n');
      if (parts.length < 2) return { historyText: medicalHistory, metadata: {} as Record<string, any> };
      try {
        return {
          historyText: parts[0],
          metadata: JSON.parse(parts[1]) as Record<string, any>
        };
      } catch {
        return { historyText: medicalHistory, metadata: {} as Record<string, any> };
      }
    };

    const { metadata } = extractMetadata(patientProfile?.medical_history ?? null);
    const patientName = patientProfile?.full_name || user?.name || 'John Smith';
    const assignedDoctor = metadata.assigned_doctor || 'Dr. Sarah Jenkins';

    const latestLabel = latestAnalysis?.label || 'Healthy';
    const latestRiskScore = latestAnalysis ? `${Math.round(latestAnalysis.riskScore)}%` : '12%';
    const riskLevelText = latestAnalysis?.riskLevel || 'Low';

    const getInitials = (name: string) => {
      return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="space-y-6 font-sans text-clinical-ink dark:text-white"
      >
        {/* Header welcome banner */}
        <div className="bg-gradient-to-br from-[#EEF5FF] to-white dark:from-[#0C111C] dark:to-[#181E32] border border-clinical-border dark:border-slate-800 rounded-clinical p-6 shadow-soft flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fadeIn">
          <div>
            <p className="text-[10px] font-bold text-clinical-primary uppercase tracking-widest">PATIENT PORTAL</p>
            <h2 className="text-2xl font-extrabold mt-1 text-slate-900 dark:text-white">Welcome back, {patientName}</h2>
            <p className="text-xs text-clinical-textSecondary mt-1">Access your historical MRI records, AI interpretation summaries, and care team details.</p>
          </div>
        </div>

        {/* Demographics & Care Team Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Card 1: Care Team */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-[20px] text-clinical-primary font-bold">🩺</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-clinical-textSecondary">Primary Clinician</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-clinical-primary/10 border border-clinical-primary/20 flex items-center justify-center text-clinical-primary font-bold text-base">
                {getInitials(assignedDoctor)}
              </div>
              <div>
                <p className="text-xs font-extrabold text-slate-950 dark:text-white">{assignedDoctor}</p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Assigned Specialist</p>
              </div>
            </div>
            <div className="pt-2 text-[10px] font-semibold text-clinical-textSecondary leading-relaxed space-y-1.5">
              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                <span>Facility:</span>
                <span className="text-slate-800 dark:text-slate-200">NeuroScan Center</span>
              </div>
              <div className="flex justify-between">
                <span>Contact:</span>
                <span className="text-slate-800 dark:text-slate-200">specialist@neuroscan.ai</span>
              </div>
            </div>
          </div>

          {/* Card 2: Next Scheduled Review */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-[20px] text-clinical-primary font-bold">📅</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-clinical-textSecondary">Next Appointment</h3>
            </div>
            <div>
              <p className="text-lg font-extrabold text-clinical-primary">22 July, 2026</p>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">At 10:00 AM (Assessment Review)</p>
            </div>
            <div className="pt-2 text-[10px] font-semibold text-clinical-textSecondary leading-relaxed space-y-1">
              <span className="block font-bold text-[9px] uppercase tracking-wide">Pre-appointment Notes:</span>
              <p className="mt-1 text-slate-650 dark:text-slate-400">Your latest MRI imaging dossier has been uploaded for evaluation.</p>
            </div>
          </div>

          {/* Card 3: Latest Diagnostic Summary */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-[20px] text-clinical-primary font-bold">📊</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-clinical-textSecondary">Latest Diagnostic Summary</h3>
            </div>
            <div>
              <span className={`inline-flex text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                latestLabel.toLowerCase().includes('healthy') || latestLabel.toLowerCase().includes('non')
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-red-500/10 text-red-500 border-red-500/20'
              }`}>{latestLabel}</span>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-350 mt-2 leading-relaxed">
                The AI model computed a risk score of <span className="font-bold text-clinical-primary">{latestRiskScore}</span> during your last MRI check-up, indicating <span className="font-semibold">{riskLevelText}</span> risk range parameters.
              </p>
            </div>
          </div>
        </div>

        {/* Large Action Buttons */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5 pt-2">
          <button onClick={() => navigate('/results')} className="p-5 border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] hover:border-clinical-primary text-left shadow-soft flex flex-col justify-between h-28 group transition-all">
            <MaterialIcon name="analytics" className="text-[32px] text-clinical-primary group-hover:scale-105 transition-transform" />
            <div>
              <p className="text-xs font-bold text-clinical-ink dark:text-white block">MRI Results</p>
              <span className="text-[10px] text-clinical-textSecondary mt-0.5 block">View latest scan reports</span>
            </div>
          </button>

          <button onClick={() => navigate('/reports')} className="p-5 border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] hover:border-clinical-primary text-left shadow-soft flex flex-col justify-between h-28 group transition-all">
            <MaterialIcon name="description" className="text-[32px] text-clinical-primary group-hover:scale-105 transition-transform" />
            <div>
              <p className="text-xs font-bold text-clinical-ink dark:text-white block">Medical Reports</p>
              <span className="text-[10px] text-clinical-textSecondary mt-0.5 block">Download clinical PDF files</span>
            </div>
          </button>

          <button onClick={() => navigate('/history')} className="p-5 border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] hover:border-clinical-primary text-left shadow-soft flex flex-col justify-between h-28 group transition-all">
            <MaterialIcon name="history" className="text-[32px] text-clinical-primary group-hover:scale-105 transition-transform" />
            <div>
              <p className="text-xs font-bold text-clinical-ink dark:text-white block">Scan History</p>
              <span className="text-[10px] text-clinical-textSecondary mt-0.5 block">Chronological imaging logs</span>
            </div>
          </button>

          <button onClick={() => navigate('/assistant')} className="p-5 border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] hover:border-clinical-primary text-left shadow-soft flex flex-col justify-between h-28 group transition-all">
            <MaterialIcon name="psychology" className="text-[32px] text-clinical-primary group-hover:scale-105 transition-transform" />
            <div>
              <p className="text-xs font-bold text-clinical-ink dark:text-white block">Consult JEMMI</p>
              <span className="text-[10px] text-clinical-textSecondary mt-0.5 block">Ask about cognitive health</span>
            </div>
          </button>

          <button onClick={() => navigate('/profile')} className="p-5 border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] hover:border-clinical-primary text-left shadow-soft flex flex-col justify-between h-28 group transition-all col-span-2 md:col-span-1">
            <MaterialIcon name="person" className="text-[32px] text-clinical-primary group-hover:scale-105 transition-transform" />
            <div>
              <p className="text-xs font-bold text-clinical-ink dark:text-white block">My Profile</p>
              <span className="text-[10px] text-clinical-textSecondary mt-0.5 block">Update demographics detail</span>
            </div>
          </button>
        </div>
      </motion.div>
    );
  };

  if (user?.role === 'Admin') {
    return <AdminPage />;
  }

  if (user?.role === 'User') {
    return renderPatientDashboard();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6 font-sans text-clinical-ink dark:text-white"
    >

      {/* Title & Refresh Control */}
      <div className="flex items-center justify-between border-b border-clinical-border dark:border-slate-700 pb-4">
        <div>
          <h2 className="text-2xl font-bold">{t('sidebar_dashboard', 'Dashboard')}</h2>
          <p className="text-xs text-clinical-textSecondary mt-0.5">{t('dashboard_subtitle', 'Real-time AI diagnostic telemetry and EMR workspaces')}</p>
        </div>
        <button
          onClick={() => invalidateAll()}
          className="p-2 border border-clinical-border dark:border-slate-700 rounded-clinical hover:bg-slate-50 dark:hover:bg-slate-800 text-clinical-textSecondary transition"
          title="Refresh metrics"
        >
          <MaterialIcon name="refresh" className="text-[18px]" />
        </button>
      </div>

      {/* Top 8 KPIs Panels Grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
        {kpis.map((kpi) => (
          <MedicalKpiCard
            key={kpi.label}
            title={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            trendData={kpi.trend}
            color={kpi.color}
          />
        ))}
      </div>

      {/* Large Quick Actions Buttons Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <button onClick={() => navigate('/analysis')} className="p-5 border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] hover:border-clinical-primary text-left shadow-soft flex flex-col justify-between h-28 group transition-all">
          <MaterialIcon name="upload_file" className="text-[32px] text-clinical-primary group-hover:scale-105 transition-transform" />
          <div>
            <p className="text-xs font-bold text-clinical-ink dark:text-white block">{t('sidebar_new_scan', 'New MRI Scan')}</p>
            <span className="text-[10px] text-clinical-textSecondary mt-0.5 block">Upload brain MRI scan</span>
          </div>
        </button>

        <button onClick={() => navigate('/history')} className="p-5 border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] hover:border-clinical-primary text-left shadow-soft flex flex-col justify-between h-28 group transition-all">
          <MaterialIcon name="groups" className="text-[32px] text-clinical-primary group-hover:scale-105 transition-transform" />
          <div>
            <p className="text-xs font-bold text-clinical-ink dark:text-white block">{t('sidebar_patients', 'Patients')}</p>
            <span className="text-[10px] text-clinical-textSecondary mt-0.5 block">Browse patient records</span>
          </div>
        </button>

        <button onClick={() => navigate('/assistant')} className="p-5 border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] hover:border-clinical-primary text-left shadow-soft flex flex-col justify-between h-28 group transition-all">
          <MaterialIcon name="chat" className="text-[32px] text-clinical-primary group-hover:scale-105 transition-transform" />
          <div>
            <p className="text-xs font-bold text-clinical-ink dark:text-white block">{t('sidebar_assistant', 'AI Assistant')}</p>
            <span className="text-[10px] text-clinical-textSecondary mt-0.5 block">Consult clinical co-pilot</span>
          </div>
        </button>

        <button onClick={() => navigate('/reports')} className="p-5 border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] hover:border-clinical-primary text-left shadow-soft flex flex-col justify-between h-28 group transition-all">
          <MaterialIcon name="description" className="text-[32px] text-clinical-primary group-hover:scale-105 transition-transform" />
          <div>
            <p className="text-xs font-bold text-clinical-ink dark:text-white block">{t('sidebar_reports', 'Reports')}</p>
            <span className="text-[10px] text-clinical-textSecondary mt-0.5 block">Signed diagnostic logs</span>
          </div>
        </button>

        <button onClick={() => navigate('/profile')} className="p-5 border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] hover:border-clinical-primary text-left shadow-soft flex flex-col justify-between h-28 group transition-all col-span-2 md:col-span-1">
          <MaterialIcon name="person" className="text-[32px] text-clinical-primary group-hover:scale-105 transition-transform" />
          <div>
            <p className="text-xs font-bold text-clinical-ink dark:text-white block">{t('sidebar_settings', 'Settings')}</p>
            <span className="text-[10px] text-clinical-textSecondary mt-0.5 block">User account details</span>
          </div>
        </button>
      </div>

      {/* Main Split Row: Recent Scan Card & Activity logs vs. Dementia Stages Ratio */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Recent Scan Card & Timeline */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-clinical-ink dark:text-white">{t('dashboard_recent_case', 'Latest Analysis Case')}</h3>
            <p className="text-[10px] text-clinical-textSecondary">Telemetry details for the last processed patient MRI</p>
          </div>

          {latestScan ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-3.5 flex flex-col justify-between">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-clinical-textSecondary block">{t('dashboard_patient_name', 'Patient Name')}</span>
                    <span className="font-bold text-clinical-ink dark:text-white block mt-0.5">{latestScan.patient_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-clinical-textSecondary block">{t('dashboard_mri_status', 'Prediction')}</span>
                    <span className="font-bold text-clinical-ink dark:text-white block mt-0.5">{latestScan.prediction || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-clinical-textSecondary block">{t('dashboard_risk_score', 'Risk Score')}</span>
                    <span className={`block mt-0.5 ${getStatusTextStyle(latestScan.risk_category)}`}>
                      {latestScan.risk_category || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-clinical-textSecondary block">{t('results_confidence', 'Confidence')}</span>
                    <span className="font-bold text-clinical-ink dark:text-white block mt-0.5">{formatPercent(latestScan.confidence)}</span>
                  </div>
                </div>

                <div className="text-[10px] text-clinical-textSecondary mt-2">
                  Scan Timestamp: <span className="font-mono">{new Date(latestScan.date).toLocaleString()}</span>
                </div>

                <Link
                  to={`/results/${latestScan.scan_id}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4.5 py-2 mt-3 bg-clinical-primary hover:bg-[#005c54] text-white font-bold text-xs rounded-clinical transition w-fit"
                >
                  {t('dashboard_view_results', 'Open Results Viewport')} <MaterialIcon name="chevron_right" className="text-[16px]" />
                </Link>
              </div>

              {/* Activity Timeline */}
              <div className="border-l border-slate-100 dark:border-slate-800 pl-5 space-y-4">
                <span className="text-[10px] uppercase font-bold text-clinical-textSecondary block pb-1 border-b border-slate-50 dark:border-slate-800">Pipeline Activity Logs</span>
                <div className="space-y-3 text-[11px] font-semibold">
                  <div className="flex items-start gap-2 text-clinical-status-normal">
                    <span className="h-2 w-2 rounded-full bg-clinical-status-normal mt-1 shrink-0" />
                    <div>
                      <p className="leading-tight">MRI Scan Payload Uploaded</p>
                      <span className="text-[9px] text-clinical-textSecondary font-mono mt-0.5 block">{new Date(latestScan.date).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-clinical-status-normal">
                    <span className="h-2 w-2 rounded-full bg-clinical-status-normal mt-1 shrink-0" />
                    <div>
                      <p className="leading-tight">CNN Analysis Completed</p>
                      <span className="text-[9px] text-clinical-textSecondary font-mono mt-0.5 block">ResNet inference classification successful</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-clinical-status-normal">
                    <span className="h-2 w-2 rounded-full bg-clinical-status-normal mt-1 shrink-0" />
                    <div>
                      <p className="leading-tight">Grad-CAM Heatmap Rendered</p>
                      <span className="text-[9px] text-clinical-textSecondary font-mono mt-0.5 block">Voxel activation maps saved</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-clinical-status-normal">
                    <span className="h-2 w-2 rounded-full bg-clinical-status-normal mt-1 shrink-0" />
                    <div>
                      <p className="leading-tight">Diagnostic PDF Report Prepared</p>
                      <span className="text-[9px] text-clinical-textSecondary font-mono mt-0.5 block">Ready for clinical sign-off signature</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-clinical-textSecondary py-10 text-center font-bold">No latest scan record synced</p>
          )}
        </div>

        {/* Donut Risk Distribution */}
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft flex flex-col justify-between">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-clinical-ink dark:text-white">Dementia Stage Breakdown</h3>
            <p className="text-[10px] text-clinical-textSecondary">Statistical ratio of clinical case classifications</p>
          </div>

          <div className="h-40 flex items-center justify-center my-2">
            {modelOutputData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={modelOutputData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {modelOutputData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [value, 'Patients']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-clinical-textSecondary font-semibold">Distribution empty</p>
            )}
          </div>

          <div className="space-y-1.5 mt-2">
            {modelOutputData.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between text-[10px] font-bold text-clinical-textSecondary">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: chartColors[idx % chartColors.length] }} />
                  <span>{item.name}</span>
                </div>
                <span className="font-mono text-clinical-ink dark:text-white">{item.value} cases</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Analytics Charts Grid */}
      <div className="grid gap-6 md:grid-cols-3">

        {/* Chart 1: Scans Volume */}
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase text-clinical-ink dark:text-white tracking-wider">Monthly MRI Cases</h3>
            <span className="text-[10px] text-clinical-textSecondary">Volume logs processed over time</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="Scans" stroke="#3A82F7" strokeWidth={1.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Model Confidence Trend */}
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase text-clinical-ink dark:text-white tracking-wider">Prediction Confidence</h3>
            <span className="text-[10px] text-clinical-textSecondary">Average AI confidence rates per month</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} domain={[70, 100]} />
                <Tooltip formatter={(v: any) => [`${v}%`, 'Avg Confidence']} />
                <Line type="monotone" dataKey="Confidence" stroke="#006A61" strokeWidth={1.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Prediction Categories BarChart */}
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase text-clinical-ink dark:text-white tracking-wider">Classification Grouping</h3>
            <span className="text-[10px] text-clinical-textSecondary">Total cases aggregated by prediction label</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartCategories}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3A82F7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Patient Table Directory */}
      <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-clinical-ink dark:text-white">{t('dashboard_recent_registry', 'Recent Diagnostic Registry')}</h3>
            <p className="text-[10px] text-clinical-textSecondary">Registry directory linked to local and uploaded case files</p>
          </div>
          <button
            onClick={exportToCsv}
            disabled={sortedScans.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-clinical-border dark:border-slate-700 rounded-clinical text-xs font-semibold text-clinical-textPrimary dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition"
          >
            <MaterialIcon name="database" className="text-[16px] text-clinical-primary" /> Export Directory (CSV)
          </button>
        </div>

        {/* Toolbar controls */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center text-xs">
          <div className="relative w-full sm:max-w-xs">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-clinical-textSecondary">
              <MaterialIcon name="search" className="text-[16px]" />
            </span>
            <input
              type="text"
              placeholder={t('history_search_placeholder', 'Search patient name or scan ID...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-clinical-border dark:border-slate-700 rounded-clinical bg-slate-50 dark:bg-slate-800 text-clinical-ink dark:text-white placeholder-clinical-textSecondary focus:outline-none focus:border-clinical-primary"
            />
          </div>

          <div className="flex gap-2 items-center w-full sm:w-auto justify-end">
            <span className="font-semibold text-clinical-textSecondary">Filter Risk:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="p-1.5 border border-clinical-border dark:border-slate-700 rounded-clinical bg-white dark:bg-[#1E293B] text-clinical-ink dark:text-white text-xs focus:outline-none focus:border-clinical-primary font-semibold"
            >
              <option value="All">All Severity Levels</option>
              <option value="Low">Low / Healthy</option>
              <option value="Moderate">Moderate / Warning</option>
              <option value="High">High / Alert</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Patient table */}
        <div className="overflow-x-auto relative pt-1">
          {sortedScans.length === 0 ? (
            <EmptyState
              icon={MaterialIcon}
              title="No Patient Scans Registered"
              description="No diagnostic MRI scans exist matching the filter criteria. Start a new scan to register your first record."
              actionLabel="Start New Scan"
              onAction={() => navigate('/analysis')}
            />
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-clinical-border dark:border-slate-700 text-clinical-textSecondary font-bold uppercase tracking-wider text-[10px]">
                  <th onClick={() => handleSort('patient_name')} className="px-3 py-2 cursor-pointer hover:text-clinical-primary transition-colors">
                    {t('dashboard_patient_name', 'Patient Name')} {sortField === 'patient_name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('date')} className="px-3 py-2 cursor-pointer hover:text-clinical-primary transition-colors">
                    Acquisition Date {sortField === 'date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('confidence')} className="px-3 py-2 cursor-pointer hover:text-clinical-primary transition-colors">
                    Inference Confidence {sortField === 'confidence' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('risk_category')} className="px-3 py-2 cursor-pointer hover:text-clinical-primary transition-colors">
                    Risk Category {sortField === 'risk_category' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className="px-3 py-2 text-right">{t('dashboard_actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedScans.map((scan) => (
                  <tr key={scan.row_key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-3 py-2.5">
                      {scan.id ? (
                        <Link to={`/patients/${scan.id}`} className="font-bold text-clinical-ink dark:text-white hover:text-clinical-primary transition">
                          {scan.patient_name}
                        </Link>
                      ) : (
                        <span className="font-bold text-clinical-ink dark:text-white">{scan.patient_name}</span>
                      )}
                      <p className="text-[9px] text-clinical-textSecondary font-mono mt-0.5">UID: {scan.scan_id.substring(0, 12).toUpperCase()}...</p>
                    </td>
                    <td className="px-3 py-2.5 text-clinical-textPrimary dark:text-slate-300 font-semibold">
                      {new Date(scan.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-clinical-textPrimary dark:text-slate-300 font-bold">
                      {formatPercent(scan.confidence)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                        scan.risk_category?.toLowerCase() === 'critical' || scan.risk_category?.toLowerCase() === 'high'
                          ? 'bg-red-500/10 text-red-500 border-red-500/20'
                          : scan.risk_category?.toLowerCase() === 'medium' || scan.risk_category?.toLowerCase() === 'moderate'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}>
                        {scan.risk_category || 'Evaluating'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {scan.report_id ? (
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => handleOpenReport(scan.report_id as string)}
                            className="text-clinical-primary hover:text-[#005c54] font-bold flex items-center gap-1 transition"
                            title="Open clinical report"
                          >
                            <MaterialIcon name="description" className="text-[16px]" /> {t('sidebar_reports', 'Report')}
                          </button>
                          <Link
                            to={`/results/${scan.scan_id}`}
                            className="p-1 border border-clinical-border dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-clinical-textSecondary hover:text-clinical-ink dark:hover:text-white transition"
                            title="PACS Workspace"
                          >
                            <MaterialIcon name="chevron_right" className="text-[16px]" />
                          </Link>
                        </div>
                      ) : (
                        <span className="text-clinical-textSecondary font-bold uppercase tracking-wider text-[9px] animate-pulse">Processing</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </motion.div>
  );
}
