import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { deleteReport, downloadReportPdf, fetchReportSummaries, openReportPdf } from '../services/reportService';
import { useToastContext } from '../hooks/useToastContext';
import { useAuth } from '../hooks/useAuth';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import { useLanguage } from '../hooks/useLanguage';
import { normalizeError, getUserFriendlyMessage } from '../utils/errorHandler';
import ProfileAvatar from '../components/ProfileAvatar';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import MaterialIcon from '../components/MaterialIcon';
import SkeletonLoader from '../components/SkeletonLoader';
import ClinicalTable, { TableColumn } from '../components/ClinicalTable';
import type { ReportSummary } from '../services/reportService';
import type { PredictionLabel } from '../types';

const predictionOptions: Array<PredictionLabel | ''> = [
  '',
  'Non Demented',
  'Very Mild Demented',
  'Mild Demented',
  'Moderate Demented',
];
const statusOptions = ['', 'generated', 'pending', 'failed'];
const pageSize = 10;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatStatus(status?: string) {
  if (!status) return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function ReportsPage() {
  const toast = useToastContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchParam = searchParams.get('search') || '';

  const { user } = useAuth();
  const { photoUrl } = useProfilePhoto();
  const { t } = useLanguage();

  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [query, setQuery] = useState(searchParam);
  const [predictionFilter, setPredictionFilter] = useState<PredictionLabel | ''>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ReportSummary | null>(null);

  useEffect(() => {
    const requestId = window.setTimeout(() => {
      const loadReports = async () => {
        try {
          setIsLoading(true);
          setError(null);
          const reportList = await fetchReportSummaries({
            search: query.trim() || undefined,
            prediction: predictionFilter || undefined,
            status: statusFilter || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            limit: 1000,
            offset: 0,
          });
          setReports(reportList);
        } catch (err) {
          const errorInfo = normalizeError(err);
          const message = getUserFriendlyMessage(errorInfo);
          setError(message);
          toast.error(message);
        } finally {
          setIsLoading(false);
        }
      };

      loadReports();
    }, 250);

    return () => window.clearTimeout(requestId);
  }, [toast, query, predictionFilter, statusFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    setQuery(searchParam);
  }, [searchParam]);

  const resetToFirstPage = () => setPage(0);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    resetToFirstPage();
  };

  const clearFilters = () => {
    setQuery('');
    setPredictionFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  };

  const handleDownload = async (reportId: string) => {
    try {
      const blob = await downloadReportPdf(reportId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `neuroscan-report-${reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      const errorInfo = normalizeError(err);
      toast.error(getUserFriendlyMessage(errorInfo));
    }
  };

  const handleOpen = async (reportId: string) => {
    try {
      await openReportPdf(reportId);
    } catch (err) {
      const errorInfo = normalizeError(err);
      toast.error(getUserFriendlyMessage(errorInfo));
    }
  };

  const handleDelete = (report: ReportSummary) => {
    setDeleteConfirm(report);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const report = deleteConfirm;
    setDeleteConfirm(null);

    try {
      setDeletingId(report.id);
      await deleteReport(report.id);
      setReports((current) => current.filter((entry) => entry.id !== report.id && entry.report_id !== report.report_id));
      toast.success('Report deleted successfully');
    } catch (err) {
      const errorInfo = normalizeError(err);
      toast.error(getUserFriendlyMessage(errorInfo));
    } finally {
      setDeletingId(null);
    }
  };

  const hasFilters = Boolean(query || predictionFilter || statusFilter || dateFrom || dateTo);

  if (isLoading) {
    return <SkeletonLoader type="reports" />;
  }

  if (error) {
    return (
      <div className="py-16 text-center space-y-4 max-w-sm mx-auto animate-fade-in">
        <MaterialIcon name="warning" className="text-[44px] text-clinical-status-critical mx-auto" />
        <h3 className="text-lg font-bold text-clinical-ink dark:text-white">Operational History Offline</h3>
        <p className="text-xs text-clinical-textSecondary">{error || 'Could not query report database'}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-clinical-primary text-white rounded-clinical text-xs font-bold transition">
          Retry Connection
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
      className="space-y-6 animate-fade-in text-clinical-ink dark:text-white"
    >

      {/* Title */}
      <div>
        <p className="text-[10px] font-bold text-clinical-primary uppercase tracking-widest">Medical Documentation</p>
        <h2 className="text-2xl font-bold mt-1">{t('reports_title', 'Signed Clinical Reports')}</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">

        {/* Left Side: Search list */}
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-3xl p-6 shadow-soft space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-clinical-border dark:border-slate-700 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Report Archives</h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Search or filter signed clinical publications</p>
            </div>
          </div>
          {/* Filters strip grid */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 text-xs font-bold text-slate-500 pb-4 border-b border-clinical-border dark:border-slate-700">
            <select
              value={predictionFilter}
              onChange={(e) => {
                setPredictionFilter(e.target.value as PredictionLabel | '');
                resetToFirstPage();
              }}
              className="px-3 py-2 rounded-3xl border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#101E36] text-slate-700 dark:text-slate-350 outline-none"
            >
              <option value="" className="dark:bg-[#101E36]">All Predictions</option>
              {predictionOptions.filter(Boolean).map((opt) => (
                <option key={opt} value={opt} className="dark:bg-[#101E36]">{opt}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                resetToFirstPage();
              }}
              className="px-3 py-2 rounded-3xl border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#101E36] text-slate-700 dark:text-slate-350 outline-none"
            >
              <option value="" className="dark:bg-[#101E36]">All Statuses</option>
              {statusOptions.filter(Boolean).map((opt) => (
                <option key={opt} value={opt} className="dark:bg-[#101E36]">{formatStatus(opt)}</option>
              ))}
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                resetToFirstPage();
              }}
              className="px-3 py-2 rounded-3xl border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#101E36] text-slate-700 dark:text-slate-350 outline-none"
              aria-label="Start Date"
            />

            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                resetToFirstPage();
              }}
              className="px-3 py-2 rounded-3xl border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#101E36] text-slate-700 dark:text-slate-350 outline-none"
              aria-label="End Date"
            />

            <button
              onClick={clearFilters}
              disabled={!hasFilters}
              className="px-4 py-2 border border-clinical-border dark:border-slate-700 rounded-3xl text-slate-700 dark:text-slate-350 hover:bg-[#EEF5FF] dark:hover:bg-[#101E36] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Clear
            </button>
          </div>

          {/* Clinical reports table */}
          <ClinicalTable
            columns={[
              { key: 'report_id', label: 'Report ID' },
              { key: 'patient_name', label: 'Patient' },
              { key: 'prediction', label: 'Diagnosis' },
              { key: 'confidence', label: 'Confidence' },
              { key: 'created_at', label: 'Generated' },
              { key: 'open', label: 'Open', sortable: false },
              { key: 'download', label: 'PDF', sortable: false },
              { key: 'delete', label: 'Delete', sortable: false },
            ]}
            data={reports}
            searchKeys={['patient_name', 'report_id', 'prediction']}
            searchPlaceholder={t('history_search_placeholder', 'Search patient name or report ID...')}
            onExportCsvName="neuroscan-reports-export"
            renderRow={(report: ReportSummary, index: number, visibleKeys: string[]) => (
              <tr key={report.id} className="hover:bg-[#EEF5FF]/30 dark:hover:bg-slate-900/30 transition-colors">
                {visibleKeys.includes('report_id') && (
                  <td data-label="Report ID" className="px-5 py-4 font-bold text-xs text-slate-900 dark:text-slate-200">
                    {report.report_id}
                  </td>
                )}
                {visibleKeys.includes('patient_name') && (
                  <td data-label="Patient" className="px-5 py-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {report.patient_name}
                  </td>
                )}
                {visibleKeys.includes('prediction') && (
                  <td data-label="Diagnosis" className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-300">
                    {report.prediction}
                  </td>
                )}
                {visibleKeys.includes('confidence') && (
                  <td data-label="Confidence" className="px-5 py-4 font-mono tabular-nums text-slate-700 dark:text-slate-350">
                    {Math.round(report.confidence)}%
                  </td>
                )}
                {visibleKeys.includes('created_at') && (
                  <td data-label="Generated" className="px-5 py-4 text-slate-500 font-semibold text-xs">
                    {formatDate(report.created_at)}
                  </td>
                )}
                {visibleKeys.includes('open') && (
                  <td data-label="Open" className="px-5 py-4">
                    <button
                      onClick={() => handleOpen(report.report_id)}
                      className="p-1.5 text-clinical-primary hover:bg-clinical-primary/10 rounded-clinical transition-all"
                      title="Open View"
                    >
                      <MaterialIcon name="open_in_new" className="text-[18px]" />
                    </button>
                  </td>
                )}
                {visibleKeys.includes('download') && (
                  <td data-label="PDF" className="px-5 py-4">
                    <button
                      onClick={() => handleDownload(report.report_id)}
                      className="p-1.5 text-clinical-primary hover:bg-clinical-primary/10 rounded-clinical transition-all"
                      title="Download PDF"
                    >
                      <MaterialIcon name="download" className="text-[18px]" />
                    </button>
                  </td>
                )}
                {visibleKeys.includes('delete') && (
                  <td data-label="Delete" className="px-5 py-4">
                    <button
                      onClick={() => handleDelete(report)}
                      disabled={deletingId === report.id}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-clinical transition-all disabled:opacity-50"
                      title="Delete Report"
                    >
                      {deletingId === report.id ? (
                        <MaterialIcon name="sync" className="text-[18px] animate-spin" />
                      ) : (
                        <MaterialIcon name="delete" className="text-[18px]" />
                      )}
                    </button>
                  </td>
                )}
              </tr>
            )}
          />
        </div>

        {/* Right Side: Quick info */}
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-3xl p-6 shadow-soft flex flex-col justify-between h-full">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Profile Photo Preview</h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5 font-sans">Signature avatar included on reports</p>
          </div>

          <div className="my-6 p-4 bg-[#EEF5FF] dark:bg-[#101E36] rounded-3xl flex items-center gap-4 border border-clinical-border dark:border-slate-700">
            <ProfileAvatar src={photoUrl} name={user?.name} sizeClassName="h-12 w-12" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase tracking-widest leading-none">Authorized Representative</p>
            </div>
          </div>

          <div className="space-y-3 mt-auto">
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Report Workflow Status</h4>
            {[
              'Validation checks verified',
              'Tensor preprocessing normalized',
              'ResNet CNN prediction calculated',
              'Sign-off check authorizations complete'
            ].map((step, idx) => (
              <div key={idx} className="flex items-center gap-3 px-3.5 py-2.5 rounded-3xl bg-[#EEF5FF]/50 dark:bg-[#101E36]/40 border border-clinical-border dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-350">
                <span className="h-5 w-5 bg-clinical-primary/10 text-clinical-primary border border-clinical-primary/20 rounded-full flex items-center justify-center text-[10px] font-extrabold">
                  {idx + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>

        </div>

      </div>

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="Delete Medical Report"
        message={`Are you sure you want to permanently delete clinical report ${deleteConfirm?.report_id}? This operation cannot be reverted.`}
        confirmLabel="Delete Report"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
        isDanger
      />
    </motion.div>
  );
}
