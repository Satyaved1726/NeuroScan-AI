import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { deleteAnalysisHistoryItem, fetchAnalysisHistory } from '../services/historyService';
import { downloadReportPdf } from '../services/reportService';
import { useToastContext } from '../hooks/useToastContext';
import { useAuth } from '../hooks/useAuth';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import { useLanguage } from '../hooks/useLanguage';
import { getUserFriendlyMessage, normalizeError } from '../utils/errorHandler';
import ProfileAvatar from '../components/ProfileAvatar';
import type { HistorySortBy, PredictionLabel, RiskLevel, ScanHistoryItem, SortDirection } from '../types';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import MaterialIcon from '../components/MaterialIcon';
import SkeletonLoader from '../components/SkeletonLoader';
import ClinicalTable, { TableColumn } from '../components/ClinicalTable';
import StatusChip from '../components/StatusChip';

const riskOptions: Array<RiskLevel | ''> = ['', 'Low', 'Moderate', 'High', 'Critical'];
const statusOptions = ['', 'generated', 'pending', 'failed'];
const predictionOptions: Array<PredictionLabel | ''> = [
  '',
  'Non Demented',
  'Very Mild Demented',
  'Mild Demented',
  'Moderate Demented',
];
const sortOptions: Array<{ value: HistorySortBy; label: string }> = [
  { value: 'date', label: 'Date' },
  { value: 'patient', label: 'Patient' },
  { value: 'prediction', label: 'Prediction' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'status', label: 'Status' },
  { value: 'report', label: 'Report' },
];
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

function statusClass(status?: string) {
  const normalized = (status ?? '').toLowerCase();
  if (normalized === 'generated') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  if (normalized === 'pending') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  if (normalized === 'failed') return 'bg-red-500/10 text-red-500 border-red-500/20';
  return 'bg-[#F5F8FC] dark:bg-[#0E1322] text-slate-500 border-slate-200 dark:border-white/5';
}

function formatStatus(status?: string) {
  if (!status) return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchParam = searchParams.get('search') || '';

  const toast = useToastContext();
  const { user } = useAuth();
  const { photoUrl } = useProfilePhoto();
  const { t } = useLanguage();

  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [query, setQuery] = useState(searchParam);
  const [debouncedQuery, setDebouncedQuery] = useState(searchParam);
  const [predictionFilter, setPredictionFilter] = useState<PredictionLabel | ''>('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | ''>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<HistorySortBy>('date');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ScanHistoryItem | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(0);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    setQuery(searchParam);
  }, [searchParam]);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      try {
        if (history.length === 0) {
          setIsLoading(true);
        } else {
          setIsRefreshing(true);
        }
        setError(null);
        const result = await fetchAnalysisHistory({
          q: debouncedQuery,
          prediction: predictionFilter,
          risk: riskFilter,
          status: statusFilter,
          dateFrom,
          dateTo: dateTo ? `${dateTo}T23:59:59` : '',
          sortBy: 'date',
          sortDir: 'desc',
          limit: 1000,
          offset: 0,
        });
        if (isMounted) {
          setHistory(result.items);
          setTotal(result.total);
        }
      } catch (err) {
        if (isMounted) {
          const message = getUserFriendlyMessage(normalizeError(err));
          setError(message);
          toast.error(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [dateFrom, dateTo, debouncedQuery, page, predictionFilter, riskFilter, statusFilter, sortBy, sortDir, toast]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rangeText = useMemo(() => {
    if (total === 0) {
      return '0 results';
    }
    const start = page * pageSize + 1;
    const end = Math.min(total, (page + 1) * pageSize);
    return `${start}-${end} of ${total}`;
  }, [page, total]);

  const resetToFirstPage = () => setPage(0);

  const handleDownloadReport = async (reportId: string) => {
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
      toast.success('Report downloaded');
    } catch (err) {
      toast.error(getUserFriendlyMessage(normalizeError(err)));
    }
  };

  const handleDelete = (item: ScanHistoryItem) => {
    setDeleteConfirm(item);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const item = deleteConfirm;
    setDeleteConfirm(null);

    try {
      setDeletingId(item.id);
      await deleteAnalysisHistoryItem(item.id);
      setHistory((current) => current.filter((entry) => entry.id !== item.id));
      setTotal((current) => Math.max(0, current - 1));
      toast.success('History item deleted successfully');
    } catch (err) {
      toast.error(getUserFriendlyMessage(normalizeError(err)));
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return <SkeletonLoader type="history" />;
  }

  if (error && history.length === 0) {
    return (
      <div className="py-20 text-center space-y-4 max-w-sm mx-auto">
        <MaterialIcon name="warning" className="text-[44px] text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Scan History Offline</h3>
        <p className="text-xs text-slate-500 dark:text-slate-500">{error || 'Could not query history database'}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-clinical-primary text-white rounded-3xl text-xs font-bold transition">
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
      className="space-y-6 text-clinical-ink dark:text-white"
    >

      {/* Title Panel */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3 pl-6 lg:pl-10">
        <p className="text-[10px] font-bold text-clinical-primary uppercase tracking-widest">Medical Records</p>
        <h2 className="text-2xl font-bold mt-1">Clinical Workspace</h2>
      </div>

      <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-3xl p-6 shadow-soft space-y-6">

        {/* User Card Strip */}
        <div className="flex items-center gap-3 rounded-3xl bg-[#EEF5FF] dark:bg-[#101E36] px-4 py-3 border border-clinical-border dark:border-slate-700">
          <ProfileAvatar src={photoUrl} name={user?.name} sizeClassName="h-10 w-10" />
          <div className="min-w-0">
            <p className="truncate font-extrabold text-xs text-slate-900 dark:text-slate-200">{user?.name ?? 'Clinician'}</p>
            <p className="truncate text-[10px] text-slate-500 font-bold uppercase tracking-wide">
              Analysis logs representing active clinician profile scans
            </p>
          </div>
        </div>

        {/* Filters Panel Grid */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 text-xs font-bold text-slate-500">

          <select
            value={predictionFilter}
            onChange={(event) => {
              setPredictionFilter(event.target.value as PredictionLabel | '');
              resetToFirstPage();
            }}
            className="min-h-11 rounded-3xl border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-350 outline-none px-2 cursor-pointer"
            aria-label="Filter by prediction"
          >
            {predictionOptions.map((option) => (
              <option key={option || 'all'} value={option} className="dark:bg-[#1E293B]">{option || 'All predictions'}</option>
            ))}
          </select>

          <select
            value={riskFilter}
            onChange={(event) => {
              setRiskFilter(event.target.value as RiskLevel | '');
              resetToFirstPage();
            }}
            className="min-h-11 rounded-3xl border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-355 outline-none px-2 cursor-pointer"
            aria-label="Filter by risk category"
          >
            {riskOptions.map((option) => (
              <option key={option || 'all'} value={option} className="dark:bg-[#1E293B]">{option ? `${option} risk` : 'All risks'}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              resetToFirstPage();
            }}
            className="min-h-11 rounded-3xl border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-350 outline-none px-2 cursor-pointer"
            aria-label="Filter by status"
          >
            {statusOptions.map((option) => (
              <option key={option || 'all'} value={option} className="dark:bg-[#1E293B]">{option ? `${formatStatus(option)} status` : 'All statuses'}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 px-3 border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] rounded-3xl min-h-11">
            <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                resetToFirstPage();
              }}
              className="w-full bg-transparent text-slate-700 dark:text-slate-355 outline-none text-xs font-semibold cursor-pointer"
              aria-label="Filter from date"
            />
          </div>

          <div className="flex items-center gap-2 px-3 border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] rounded-3xl min-h-11">
            <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                resetToFirstPage();
              }}
              className="w-full bg-transparent text-slate-700 dark:text-slate-355 outline-none text-xs font-semibold cursor-pointer"
              aria-label="Filter to date"
            />
          </div>
        </div>

        {/* Clear Filters options */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-500">
          <span>{isRefreshing ? 'Refreshing...' : rangeText}</span>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setPredictionFilter('');
              setRiskFilter('');
              setStatusFilter('');
              setDateFrom('');
              setDateTo('');
              setSortBy('date');
              setSortDir('desc');
              setPage(0);
            }}
            className="text-clinical-primary hover:text-[#005c54] transition font-extrabold cursor-pointer"
          >
            Clear all filters
          </button>
        </div>

        {/* Reusable advanced clinical table */}
        <ClinicalTable
          title="MRI Scan Logs"
          columns={[
            { key: 'thumbnailUrl', label: 'Thumbnail', sortable: false },
            { key: 'patientName', label: 'Patient Name' },
            { key: 'prediction', label: 'Diagnosis' },
            { key: 'confidence', label: 'Confidence' },
            { key: 'date', label: 'Date' },
            { key: 'status', label: 'Status' },
            { key: 'open', label: 'Open', sortable: false },
            { key: 'download', label: 'PDF', sortable: false },
            { key: 'delete', label: 'Delete', sortable: false },
          ]}
          data={history}
          searchKeys={['patientName', 'reportId', 'scanId', 'prediction']}
          searchPlaceholder={t('history_search_placeholder', 'Search patient name or scan ID...')}
          onExportCsvName="neuroscan-history-export"
          searchQuery={query}
          onSearchQueryChange={setQuery}
          renderRow={(item: ScanHistoryItem, index: number, visibleKeys: string[]) => (
            <tr key={item.id} className="hover:bg-[#EEF5FF]/30 dark:hover:bg-slate-900/30 transition-colors">
              {visibleKeys.includes('thumbnailUrl') && (
                <td data-label="Thumbnail" className="px-5 py-4">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-3xl border border-clinical-border dark:border-slate-800 bg-[#F5F8FC] dark:bg-[#101E36]">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={`MRI thumbnail`} className="h-full w-full object-cover" />
                    ) : (
                      <MaterialIcon name="image" className="text-[20px] text-slate-500" />
                    )}
                  </div>
                </td>
              )}
              {visibleKeys.includes('patientName') && (
                <td data-label="Patient Name" className="px-5 py-4">
                  <p className="font-extrabold text-slate-900 dark:text-slate-200">{item.patientName ?? user?.name ?? 'Patient profile pending'}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500 font-semibold">{item.reportId || item.id}</p>
                </td>
              )}
              {visibleKeys.includes('prediction') && (
                <td data-label="Diagnosis" className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-300">{item.prediction}</td>
              )}
              {visibleKeys.includes('confidence') && (
                <td data-label="Confidence" className="px-5 py-4 font-mono tabular-nums text-slate-700 dark:text-slate-350">{Math.round(item.confidence)}%</td>
              )}
              {visibleKeys.includes('date') && (
                <td data-label="Date" className="px-5 py-4 text-slate-500 font-semibold">{formatDate(item.date)}</td>
              )}
              {visibleKeys.includes('status') && (
                <td data-label="Status" className="px-5 py-4">
                  <StatusChip status={item.status || 'pending'} />
                </td>
              )}
              {visibleKeys.includes('open') && (
                <td data-label="Open" className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => navigate(`/results/${item.scanId}`)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-3xl border border-clinical-border dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-[#EEF5FF] dark:hover:bg-[#101E36] transition cursor-pointer"
                    title="Open result"
                  >
                    <MaterialIcon name="open_in_new" className="text-[16px]" />
                  </button>
                </td>
              )}
              {visibleKeys.includes('download') && (
                <td data-label="PDF" className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => handleDownloadReport(item.reportId)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-3xl border border-clinical-border dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-[#EEF5FF] dark:hover:bg-[#101E36] transition cursor-pointer"
                    title="Download PDF"
                  >
                    <MaterialIcon name="download" className="text-[16px]" />
                  </button>
                </td>
              )}
              {visibleKeys.includes('delete') && (
                <td data-label="Delete" className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-3xl border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    title="Delete"
                  >
                    {deletingId === item.id ? (
                      <MaterialIcon name="sync" className="text-[16px] animate-spin" />
                    ) : (
                      <MaterialIcon name="delete" className="text-[16px]" />
                    )}
                  </button>
                </td>
              )}
            </tr>
          )}
        />
      </div>

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="Delete Scan Record"
        message={`Are you sure you want to permanently delete history item ${deleteConfirm?.reportId}? This cannot be undone.`}
        confirmLabel="Delete Item"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
        isDanger
      />
    </motion.div>
  );
}
