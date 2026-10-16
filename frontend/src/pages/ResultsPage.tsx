import { useEffect, useMemo, useState, useRef, PointerEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useToastContext } from '../hooks/useToastContext';
import { useMRIWorkflow } from '../hooks/useMRIWorkflow';
import { useLanguage } from '../hooks/useLanguage';
import { downloadReportPdf, fetchReport } from '../services/reportService';
import { fetchLatestAnalysis, generateHeatmap } from '../services/mriService';
import { fetchAnalysisHistory } from '../services/historyService';
import { fetchDoctorNotes, addDoctorNote, type DoctorNote } from '../services/notesService';
import { PredictionResult } from '../types/mri-workflow';
import { normalizeError, getUserFriendlyMessage } from '../utils/errorHandler';
import EmptyState from '../components/EmptyState';
import MaterialIcon from '../components/MaterialIcon';
import SkeletonLoader from '../components/SkeletonLoader';

type ClassKey = 'NonDemented' | 'VeryMildDemented' | 'MildDemented' | 'ModerateDemented';

const CLASS_STYLES: Record<ClassKey, { label: string; color: string; badge: string; text: string; bg: string }> = {
  NonDemented: {
    label: 'Non Demented',
    color: '#14A44D',
    badge: 'bg-[#14A44D]/10 text-[#14A44D] border border-[#14A44D]/25',
    text: 'text-[#14A44D]',
    bg: 'from-[#14A44D]/5 to-transparent',
  },
  VeryMildDemented: {
    label: 'Very Mild Demented',
    color: '#2563EB',
    badge: 'bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/25',
    text: 'text-[#2563EB]',
    bg: 'from-[#2563EB]/5 to-transparent',
  },
  MildDemented: {
    label: 'Mild Demented',
    color: '#D97706',
    badge: 'bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/25',
    text: 'text-[#D97706]',
    bg: 'from-[#D97706]/5 to-transparent',
  },
  ModerateDemented: {
    label: 'Moderate Demented',
    color: '#DC2626',
    badge: 'bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/25',
    text: 'text-[#DC2626]',
    bg: 'from-[#DC2626]/5 to-transparent',
  },
};

const UNKNOWN_CLASS_STYLE = {
  label: 'Unknown',
  color: '#6B7280',
  badge: 'bg-slate-100 text-slate-500 border border-slate-200',
  text: 'text-slate-500',
  bg: 'from-slate-50 to-transparent',
};

const RECOMMENDATION_CATEGORIES = ['Medical', 'Lifestyle', 'Nutrition', 'Exercise', 'MentalHealth', 'FollowUp'];

function normalizeClassName(label: string): ClassKey {
  const clean = label.replace(/\s+/g, '').toLowerCase();
  if (clean.includes('non')) return 'NonDemented';
  if (clean.includes('verymild')) return 'VeryMildDemented';
  if (clean.includes('mild')) return 'MildDemented';
  if (clean.includes('mod')) return 'ModerateDemented';
  return 'NonDemented';
}

function formatClassName(label: string): string {
  const norm = normalizeClassName(label);
  return CLASS_STYLES[norm]?.label ?? label;
}

interface ScanHistoryItem {
  id: string;
  scanId: string;
  date: string;
  prediction: string;
  confidence: number;
  risk: string;
}

function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Pending';
  try {
    return new Date(dateString).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Pending';
  }
}

const getStatusTextStyle = (risk: string | null | undefined) => {
  switch (risk?.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'text-clinical-status-critical font-bold';
    case 'medium':
    case 'moderate':
      return 'text-clinical-status-warning font-bold';
    case 'normal':
    case 'low':
    case 'stable':
    case 'non-demented':
      return 'text-clinical-status-normal font-bold';
    default:
      return 'text-clinical-textSecondary font-semibold';
  }
};

export default function ResultsPage() {
  const params = useParams<{ scanId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const workflow = useMRIWorkflow();
  const routeState = location.state as { prediction?: PredictionResult; preview?: string } | undefined;
  const { t } = useLanguage();

  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null);
  const [isReportDownloading, setIsReportDownloading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Timeline history state
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(true);

  // Viewport states
  const [activeViewTab, setActiveViewTab] = useState<'original' | 'heatmap' | 'heatmapOnly' | 'compare' | 'sideBySide'>('heatmap');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [comparisonPosition, setComparisonPosition] = useState(50);
  const [heatmapOpacity, setHeatmapOpacity] = useState(65);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [isInverted, setIsInverted] = useState(false);
  const [selectedLut, setSelectedLut] = useState<'none' | 'hot' | 'cool' | 'sepia' | 'emerald'>('none');
  const [showHud, setShowHud] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const toast = useToastContext();

  const scanId = params.scanId ?? routeState?.prediction?.scanId;
  const [doctorNotesList, setDoctorNotesList] = useState<DoctorNote[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteSeverity, setNewNoteSeverity] = useState<'Low' | 'Medium' | 'High'>('Low');

  // Fullscreen support
  const toggleFullscreen = () => {
    if (!viewerContainerRef.current) return;
    if (!document.fullscreenElement) {
      viewerContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  useEffect(() => {
    if (scanId) {
      fetchDoctorNotes(scanId)
        .then((data) => setDoctorNotesList(data))
        .catch(() => {});
    }
  }, [scanId]);

  const activeClass = prediction ? normalizeClassName(prediction.label) : null;
  const activeStyle = activeClass ? CLASS_STYLES[activeClass] : UNKNOWN_CLASS_STYLE;

  const buildProbabilityData = (report: PredictionResult) => {
    if (!report.probabilities) return [];
    return Object.entries(report.probabilities).map(([key, val]) => {
      const norm = normalizeClassName(key);
      const style = CLASS_STYLES[norm] ?? UNKNOWN_CLASS_STYLE;
      return {
        className: key,
        displayName: style.label,
        probability: Number(val),
        color: style.color,
      };
    });
  };

  const probabilityData = useMemo(() => (prediction ? buildProbabilityData(prediction) : []), [prediction]);
  const recommendations = useMemo(
    () => (prediction?.recommendations && Object.keys(prediction.recommendations).length ? prediction.recommendations : {}),
    [prediction],
  );

  const getFilterStyle = (isHeatmap = false) => {
    let base = `brightness(${brightness}%) contrast(${contrast}%)`;
    if (isInverted) {
      base += ' invert(100%)';
    }
    if (isHeatmap) {
      switch (selectedLut) {
        case 'hot':
          base += ' saturate(200%) hue-rotate(330deg)';
          break;
        case 'cool':
          base += ' saturate(150%) hue-rotate(180deg)';
          break;
        case 'sepia':
          base += ' sepia(100%)';
          break;
        case 'emerald':
          base += ' sepia(80%) hue-rotate(80deg) saturate(180%)';
          break;
        default:
          break;
      }
    }
    return base;
  };

  useEffect(() => {
    const loadResults = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (routeState?.prediction) {
          setPrediction(routeState.prediction);
          setPreviewImage(routeState.prediction.originalImageUrl || routeState.preview || null);
          setHeatmapUrl(routeState.prediction.heatmapUrl || null);
          return;
        }

        if (scanId) {
          const report = await fetchReport(scanId);
          setPrediction(report);
          setHeatmapUrl(report.heatmapUrl || null);
          return;
        }

        const latest = await fetchLatestAnalysis();
        if (latest) {
          setPrediction(latest);
          setHeatmapUrl(latest.heatmapUrl || null);
        } else {
          setError('No scan results found');
        }
      } catch (err) {
        const errorInfo = normalizeError(err);
        const message = getUserFriendlyMessage(errorInfo);
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadResults();
  }, [scanId, routeState, toast]);

  // Background fetch of heatmap if scan is loaded but heatmap was deferred
  useEffect(() => {
    const currentScanId = prediction?.scanId ?? scanId;
    if (currentScanId && !heatmapUrl && !isLoading) {
      generateHeatmap(currentScanId)
        .then((res) => {
          if (res?.heatmapUrl) {
            setHeatmapUrl(res.heatmapUrl);
          }
        })
        .catch(() => {
          // Heatmap is optional explainability; keep base MRI visible
        });
    }
  }, [prediction?.scanId, scanId, heatmapUrl, isLoading]);

  useEffect(() => {
    let isMounted = true;
    const loadTimeline = async () => {
      try {
        setIsTimelineLoading(true);
        const result = await fetchAnalysisHistory({ limit: 5, offset: 0 });
        if (isMounted) setHistory(result.items.slice(0, 5));
      } catch {
        if (isMounted) setHistory([]);
      } finally {
        if (isMounted) setIsTimelineLoading(false);
      }
    };
    loadTimeline();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDownloadPdf = async () => {
    if (!prediction?.reportId) {
      toast.error('Report ID is pending for this scan');
      return;
    }
    try {
      setIsReportDownloading(true);
      const report = await downloadReportPdf(prediction.reportId);
      const url = URL.createObjectURL(report);
      const link = document.createElement('a');
      link.href = url;
      link.download = `neuroscan-clinical-report-${prediction.reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Clinical report downloaded successfully');
    } catch (err) {
      const errorInfo = normalizeError(err);
      toast.error(getUserFriendlyMessage(errorInfo));
    } finally {
      setIsReportDownloading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanId) {
      toast.error('Cannot save note: Scan ID is missing');
      return;
    }
    if (!newNoteTitle.trim() || !newNoteContent.trim()) {
      toast.error('Please fill in both the title and observation fields');
      return;
    }
    try {
      const added = await addDoctorNote(scanId, newNoteTitle, newNoteContent, newNoteSeverity);
      setDoctorNotesList([added, ...doctorNotesList]);
      setNewNoteTitle('');
      setNewNoteContent('');
      setNewNoteSeverity('Low');
      toast.success('Clinical observation note saved');
    } catch {
      toast.error('Failed to save observation note');
    }
  };

  const handleAssistant = () => {
    if (!prediction) return;
    navigate('/assistant', {
      state: {
        scanContext: {
          patient: {
            name: prediction.patientName ?? user?.name,
            id: prediction.patientId ?? user?.id,
            age: prediction.age,
            gender: prediction.gender,
            bloodGroup: prediction.bloodGroup,
          },
          prediction: prediction.label,
          confidence: prediction.confidence,
          riskScore: prediction.riskScore,
          riskLevel: prediction.riskLevel,
          probabilities: prediction.probabilities,
          recommendations,
          scanId: prediction.scanId,
          reportId: prediction.reportId,
        },
      },
    });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    setDragStart({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    setPan({
      x: dragStart.panX + event.clientX - dragStart.x,
      y: dragStart.panY + event.clientY - dragStart.y,
    });
  };

  if (isLoading) {
    return <SkeletonLoader type="results" />;
  }

  if (error || !prediction) {
    return (
      <div className="py-16 sm:py-20 text-center space-y-4 max-w-md mx-auto font-sans px-4">
        <MaterialIcon name="warning" className="text-[44px] text-clinical-status-critical mx-auto" />
        <h2 className="text-lg sm:text-xl font-bold text-clinical-ink dark:text-white">Scan Results Unavailable</h2>
        <p className="text-xs text-clinical-textSecondary">{error || 'Could not map prediction records'}</p>
        <button
          onClick={() => window.location.reload()}
          className="min-h-[44px] px-5 py-2.5 bg-clinical-primary text-white rounded-clinical text-xs font-bold shadow-soft"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const originalImage = prediction.originalImageUrl || previewImage;
  const scanDate = formatDateTime(prediction.dateOfScan ?? prediction.timestamp);

  // Truthful plain-language explanation generated from actual model output
  const plainLanguageExplanation = `The AI model classified this MRI image as ${prediction.label} with ${prediction.confidence.toFixed(1)}% model confidence. This is an automated screening prediction and is not a confirmed clinical diagnosis. A qualified clinician should review the image alongside the patient's full clinical history and neurological evaluations.`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6 font-sans antialiased text-clinical-textPrimary dark:text-white px-2 sm:px-4 max-w-7xl mx-auto"
    >
      {/* SECTION A: SCAN HEADER */}
      <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-4 sm:p-5 shadow-soft space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-clinical-textSecondary hover:text-clinical-primary dark:hover:text-white transition min-h-[44px]"
          >
            <MaterialIcon name="arrow_back" className="text-[18px] text-clinical-primary" />
            <span>Return to Dashboard</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleAssistant}
              className="flex-1 sm:flex-none min-h-[44px] px-3.5 py-2 bg-clinical-primary text-white hover:bg-[#005c54] text-xs font-bold rounded-clinical flex items-center justify-center gap-1.5 transition shadow-soft"
            >
              <MaterialIcon name="psychology" className="text-[18px]" />
              <span>Ask AI Assistant</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isReportDownloading}
              className="flex-1 sm:flex-none min-h-[44px] px-3.5 py-2 border border-clinical-border dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold rounded-clinical flex items-center justify-center gap-1.5 text-clinical-ink dark:text-white transition shadow-soft disabled:opacity-50"
            >
              <MaterialIcon name="download" className="text-[18px] text-clinical-primary" />
              <span>{isReportDownloading ? 'Preparing PDF...' : 'Download PDF Report'}</span>
            </button>
          </div>
        </div>

        {/* Scan Header Metadata Strip */}
        <div className="pt-3 border-t border-clinical-border dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-clinical-textSecondary">
            <span>
              Scan ID: <span className="font-mono font-bold text-clinical-ink dark:text-white">{prediction.scanId ? prediction.scanId.slice(0, 12) : 'NSA-SCAN'}</span>
            </span>
            <span>
              Date: <span className="font-semibold text-clinical-ink dark:text-white">{scanDate}</span>
            </span>
            <span>
              Status: <span className="font-bold text-emerald-600 dark:text-emerald-400">Analysis Completed</span>
            </span>
            <span>
              Report: <span className="font-semibold text-clinical-primary">{prediction.reportId || 'Ready'}</span>
            </span>
          </div>

          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Preliminary Screening • Pending Review
          </span>
        </div>
      </div>

      {/* SECTION B: PREDICTION SUMMARY & CLINICAL DISCLAIMER */}
      <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-clinical-border dark:border-slate-800 pb-3">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-clinical-primary block">
              Automated Dementia Screening Prediction
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-extrabold text-clinical-ink dark:text-white">
                {prediction.label}
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${activeStyle.badge}`}>
                {prediction.confidence.toFixed(1)}% Confidence
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-clinical border border-clinical-border dark:border-slate-750">
            <div>
              <span className="text-[9px] uppercase font-bold text-clinical-textSecondary block">Risk Index</span>
              <span className="text-sm font-extrabold text-clinical-ink dark:text-white">{Math.round(prediction.riskScore)}/100</span>
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <span className="text-[9px] uppercase font-bold text-clinical-textSecondary block">Risk Category</span>
              <span className={`text-xs uppercase font-extrabold ${getStatusTextStyle(prediction.riskLevel)}`}>{prediction.riskLevel}</span>
            </div>
          </div>
        </div>

        {/* User-Friendly Plain Language Explanation (Part 3.E) */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-850 rounded-clinical border border-clinical-border dark:border-slate-800 text-xs text-clinical-ink dark:text-slate-200 leading-relaxed">
          <p>{plainLanguageExplanation}</p>
        </div>

        {/* Class Probability Distribution (Chart + Responsive Progress Bars) */}
        <div className="space-y-3 pt-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-clinical-textSecondary block">
            Four-Class Probability Distribution
          </span>

          {/* Progress Bars for all screen sizes (optimized for mobile 320px-430px) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {probabilityData.map((item) => (
              <div
                key={item.className}
                className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded border border-clinical-border dark:border-slate-800 space-y-1.5"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-clinical-ink dark:text-white">{item.displayName}</span>
                  <span className="font-mono font-bold" style={{ color: item.color }}>
                    {item.probability.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(item.probability, 2)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION C & D: PACS VIEWER & ANALYSIS DETAILS (Responsive Grid) */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Left Column: PACS Viewer Workstation */}
        <div
          ref={viewerContainerRef}
          className={`bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-4 sm:p-5 shadow-soft space-y-4 flex flex-col justify-between ${
            isFullscreen ? 'fixed inset-0 z-50 p-6 rounded-none bg-black overflow-y-auto' : ''
          }`}
        >
          {/* Workstation Header & Mode Segmented Control */}
          <div className="space-y-3 border-b border-clinical-border dark:border-slate-800 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-clinical-ink dark:text-white">
                  PACS Viewer Workstation
                </h3>
                <p className="text-[11px] text-clinical-textSecondary">
                  Axial T1-weighted slice inspection and Grad-CAM attention map
                </p>
              </div>

              <button
                onClick={toggleFullscreen}
                className="p-2 text-clinical-textSecondary hover:text-clinical-ink dark:hover:text-white rounded border border-clinical-border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 transition"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Viewer'}
              >
                <MaterialIcon name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'} className="text-[18px]" />
              </button>
            </div>

            {/* Mobile-Friendly Mode Selector (Scrollable on small screens) */}
            <div className="flex overflow-x-auto gap-1 border border-clinical-border dark:border-slate-800 p-1 rounded-clinical bg-slate-50 dark:bg-slate-900 scrollbar-none">
              {[
                { id: 'original', label: 'Original' },
                { id: 'heatmap', label: 'Grad-CAM Overlay' },
                { id: 'heatmapOnly', label: 'Heatmap Only' },
                { id: 'compare', label: 'Split Slider' },
                { id: 'sideBySide', label: 'Side-by-Side' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveViewTab(tab.id as any)}
                  className={`min-h-[38px] px-3 py-1 rounded text-[11px] font-bold whitespace-nowrap transition-all ${
                    activeViewTab === tab.id
                      ? 'bg-clinical-primary text-white shadow-soft'
                      : 'text-clinical-textSecondary hover:text-clinical-ink hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Image Viewer Canvas */}
          <div className="relative h-[340px] sm:h-[420px] rounded-clinical overflow-hidden bg-[#0A0E17] border border-clinical-border dark:border-slate-800 flex items-center justify-center">
            {originalImage ? (
              <div
                className="w-full h-full relative flex items-center justify-center cursor-move select-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => setDragStart(null)}
                onPointerCancel={() => setDragStart(null)}
              >
                {/* HUD Overlays */}
                {showHud && (
                  <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between text-[9px] font-mono text-emerald-400 z-20 select-none">
                    <div className="flex justify-between">
                      <div className="bg-black/70 px-2 py-1 rounded backdrop-blur-[2px] border border-white/10 leading-relaxed">
                        PATIENT: {prediction.patientName || 'ANONYMOUS'}<br />
                        ID: {prediction.patientId || 'NSA-PATIENT'}<br />
                        SCAN: {scanDate}
                      </div>
                      <div className="bg-black/70 px-2 py-1 rounded backdrop-blur-[2px] border border-white/10 text-right leading-relaxed">
                        MODEL: EfficientNet-B0<br />
                        RESOLUTION: 224 x 224 px<br />
                        LAYER: top_conv
                      </div>
                    </div>

                    <div className="flex justify-between mt-auto">
                      <div className="bg-black/70 px-2 py-1 rounded backdrop-blur-[2px] border border-white/10 leading-relaxed">
                        ZOOM: {Math.round(zoom * 100)}%<br />
                        BRT: {brightness}% | CON: {contrast}%
                      </div>
                      <div className="bg-black/70 px-2 py-1 rounded backdrop-blur-[2px] border border-white/10 text-right leading-relaxed">
                        VIEW: {activeViewTab.toUpperCase()}<br />
                        OPACITY: {heatmapOpacity}%
                      </div>
                    </div>
                  </div>
                )}

                {/* 1. Original MRI View */}
                {activeViewTab === 'original' && (
                  <img
                    src={originalImage}
                    alt="Original Brain MRI"
                    className="max-h-full max-w-full object-contain"
                    style={{
                      filter: getFilterStyle(false),
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    }}
                    draggable={false}
                  />
                )}

                {/* 2. Grad-CAM Overlay View */}
                {activeViewTab === 'heatmap' && (
                  <div className="w-full h-full relative flex items-center justify-center">
                    <img
                      src={originalImage}
                      alt="Brain MRI Base"
                      className="max-h-full max-w-full object-contain"
                      style={{
                        filter: getFilterStyle(false),
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      }}
                      draggable={false}
                    />
                    {heatmapUrl && (
                      <img
                        src={heatmapUrl}
                        alt="Grad-CAM Heatmap Overlay"
                        className="absolute max-h-full max-w-full object-contain pointer-events-none"
                        style={{
                          opacity: heatmapOpacity / 100,
                          filter: getFilterStyle(true),
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        }}
                        draggable={false}
                      />
                    )}
                  </div>
                )}

                {/* 3. Heatmap-Only View (Part 3.C requirement) */}
                {activeViewTab === 'heatmapOnly' && (
                  <div className="w-full h-full relative flex items-center justify-center bg-black">
                    {heatmapUrl ? (
                      <img
                        src={heatmapUrl}
                        alt="Grad-CAM Heatmap Isolated"
                        className="max-h-full max-w-full object-contain"
                        style={{
                          filter: getFilterStyle(true),
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        }}
                        draggable={false}
                      />
                    ) : (
                      <p className="text-xs text-slate-400">Heatmap visualization is generating or unavailable for this scan.</p>
                    )}
                  </div>
                )}

                {/* 4. Split Slider View */}
                {activeViewTab === 'compare' && (
                  <div className="w-full h-full relative flex items-center justify-center">
                    <img
                      src={originalImage}
                      alt="Base MRI"
                      className="max-h-full max-w-full object-contain"
                      style={{
                        filter: getFilterStyle(false),
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      }}
                      draggable={false}
                    />
                    {heatmapUrl && (
                      <img
                        src={heatmapUrl}
                        alt="Heatmap Overlay"
                        className="absolute max-h-full max-w-full object-contain pointer-events-none"
                        style={{
                          filter: getFilterStyle(true),
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                          clipPath: `inset(0 ${100 - comparisonPosition}% 0 0)`,
                        }}
                        draggable={false}
                      />
                    )}
                    <div
                      className="absolute inset-y-0 w-0.5 bg-clinical-primary pointer-events-none z-10"
                      style={{ left: `${comparisonPosition}%` }}
                    />
                  </div>
                )}

                {/* 5. Side-by-Side View */}
                {activeViewTab === 'sideBySide' && (
                  <div className="w-full h-full grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
                    <div className="relative h-full w-full border border-slate-800 overflow-hidden flex items-center justify-center bg-slate-950 rounded">
                      <img
                        src={originalImage}
                        alt="Original MRI"
                        className="max-h-full object-contain"
                        style={{
                          filter: getFilterStyle(false),
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        }}
                        draggable={false}
                      />
                      <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-[8px] font-bold text-slate-400">ORIGINAL</span>
                    </div>

                    <div className="relative h-full w-full border border-slate-800 overflow-hidden flex items-center justify-center bg-slate-950 rounded">
                      <img
                        src={originalImage}
                        alt="Original Base"
                        className="max-h-full object-contain"
                        style={{
                          filter: getFilterStyle(false),
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        }}
                        draggable={false}
                      />
                      {heatmapUrl && (
                        <img
                          src={heatmapUrl}
                          alt="Heatmap"
                          className="absolute max-h-full object-contain pointer-events-none"
                          style={{
                            opacity: heatmapOpacity / 100,
                            filter: getFilterStyle(true),
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                          }}
                          draggable={false}
                        />
                      )}
                      <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-[8px] font-bold text-slate-400">OVERLAY</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-clinical-textSecondary">No active image mapping loaded</p>
            )}
          </div>

          {/* Viewer Controls Strip */}
          <div className="space-y-3 pt-2">
            {/* Opacity Slider for Heatmap */}
            {(activeViewTab === 'heatmap' || activeViewTab === 'sideBySide') && (
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-clinical border border-clinical-border dark:border-slate-800 space-y-1">
                <div className="flex justify-between text-xs font-bold text-clinical-textSecondary">
                  <span>Grad-CAM Opacity</span>
                  <span className="font-mono text-clinical-primary">{heatmapOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={heatmapOpacity}
                  onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-clinical-primary"
                />
              </div>
            )}

            {/* Split Position Slider */}
            {activeViewTab === 'compare' && (
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-clinical border border-clinical-border dark:border-slate-800 space-y-1">
                <div className="flex justify-between text-xs font-bold text-clinical-textSecondary">
                  <span>Split Comparison Position</span>
                  <span className="font-mono text-clinical-primary">{comparisonPosition}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={comparisonPosition}
                  onChange={(e) => setComparisonPosition(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-clinical-primary"
                />
              </div>
            )}

            {/* Brightness, Contrast & Zoom */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded border border-clinical-border dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-clinical-textSecondary block">Brightness ({brightness}%)</span>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-clinical-primary"
                />
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded border border-clinical-border dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-clinical-textSecondary block">Contrast ({contrast}%)</span>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-clinical-primary"
                />
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded border border-clinical-border dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-bold text-clinical-textSecondary">Zoom: {Math.round(zoom * 100)}%</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                    className="px-2 py-1 rounded bg-white dark:bg-slate-750 border border-clinical-border dark:border-slate-700 font-bold"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                    className="px-2 py-1 rounded bg-white dark:bg-slate-750 border border-clinical-border dark:border-slate-700 font-bold"
                  >
                    -
                  </button>
                  <button
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                      setBrightness(100);
                      setContrast(100);
                    }}
                    className="px-2 py-1 rounded bg-white dark:bg-slate-750 border border-clinical-border dark:border-slate-700 text-[10px] font-bold uppercase"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Heatmap Color Legend (Part 4 requirement) */}
            <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-clinical border border-clinical-border dark:border-slate-800 space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold text-clinical-textSecondary">
                <span>AI Attention Activation (Grad-CAM Jet Legend)</span>
                <span className="font-mono text-clinical-primary">Min → Max Attention</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 via-yellow-400 to-red-600 shadow-inner" />
              <div className="flex justify-between text-[9px] text-clinical-textSecondary font-semibold">
                <span>Low Attention (Blue)</span>
                <span>Moderate (Cyan/Yellow)</span>
                <span>Peak Attention (Red)</span>
              </div>
              <p className="text-[10px] text-clinical-textSecondary pt-1 leading-relaxed">
                <span className="font-bold text-clinical-ink dark:text-white">Clinical Note:</span> Grad-CAM visualizes image regions that contributed most to the model's classification decision. It does <b>not</b> identify lesions, tumors, or confirmed tissue pathology.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Analysis Details, Scope & Doctor Notes */}
        <div className="space-y-5">
          {/* Analysis Specifications Card (Part 3.D) */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-clinical-primary border-b border-clinical-border dark:border-slate-800 pb-2">
              Analysis Specifications & Pipeline Details
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary font-medium">Model Architecture:</span>
                <span className="font-mono font-bold text-clinical-ink dark:text-white">EfficientNet-B0 CNN</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary font-medium">Model Weights File:</span>
                <span className="font-mono text-clinical-ink dark:text-white">dementia_model.keras</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary font-medium">Input Tensor Shape:</span>
                <span className="font-mono text-clinical-ink dark:text-white">224 × 224 × 3 (RGB)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary font-medium">Grad-CAM Target Layer:</span>
                <span className="font-mono text-clinical-ink dark:text-white">top_conv</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-clinical-textSecondary font-medium">Explainability Status:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {heatmapUrl ? 'Heatmap Generated' : 'Heatmap Processing'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-clinical-textSecondary font-medium">Pre-Processing:</span>
                <span className="font-semibold text-clinical-ink dark:text-white">Bilinear Resized & Normalized</span>
              </div>
            </div>
          </div>

          {/* Additional Capabilities & Scope (Part 5 requirement) */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-clinical-primary uppercase tracking-wider">
              <MaterialIcon name="checklist" className="text-[18px]" />
              <span>Model Scope & Clinical Limitations</span>
            </div>

            <div className="space-y-2 text-xs text-clinical-textSecondary leading-relaxed">
              <div className="p-2.5 rounded bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300">
                <span className="font-bold block text-[11px] mb-0.5">✓ Currently Supported:</span>
                4-class dementia screening classification (<span className="font-semibold">NonDemented, VeryMildDemented, MildDemented, ModerateDemented</span>) from 2D axial MRI slices.
              </div>

              <div className="p-2.5 rounded bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300">
                <span className="font-bold block text-[11px] mb-0.5">⚠️ Separate Validated Models Required For:</span>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>Brain anatomical structure segmentation</li>
                  <li>Hippocampal volumetry estimation</li>
                  <li>White matter hyperintensity quantification</li>
                  <li>Stroke, infarct, or hemorrhage detection</li>
                  <li>Brain tumor or lesion detection</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Doctor Observations & Validation Notes (Part 6 & 7) */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
            <div className="flex items-center justify-between border-b border-clinical-border dark:border-slate-800 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-clinical-primary">
                Clinician Validation & Notes
              </h4>
              <span className="text-[10px] text-clinical-textSecondary font-semibold">
                {doctorNotesList.length} note(s) logged
              </span>
            </div>

            {/* Notes List */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto">
              {doctorNotesList.length > 0 ? (
                doctorNotesList.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 border border-clinical-border dark:border-slate-700 rounded-clinical bg-slate-50 dark:bg-slate-850 space-y-1 text-xs"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-clinical-ink dark:text-white">{note.title}</span>
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                        note.severity === 'High'
                          ? 'bg-red-500/10 text-red-500 border-red-500/20'
                          : note.severity === 'Medium'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}>
                        {note.severity}
                      </span>
                    </div>
                    <p className="text-clinical-textSecondary leading-relaxed">{note.note}</p>
                    <p className="text-[10px] text-clinical-textSecondary pt-1">
                      By {note.doctor_name || 'Clinician'} • {note.created_at ? new Date(note.created_at).toLocaleDateString() : 'Recent'}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center border border-dashed border-clinical-border dark:border-slate-750 rounded-clinical text-xs text-clinical-textSecondary">
                  <MaterialIcon name="notes" className="text-[24px] mx-auto text-clinical-textSecondary" />
                  <p className="mt-1">Pending Clinical Review</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">No physician notes recorded for this scan.</p>
                </div>
              )}
            </div>

            {/* Add Note Form (for Doctors and Admins) */}
            {(user?.role === 'Doctor' || user?.role === 'Admin') && (
              <form onSubmit={handleAddNote} className="space-y-3 pt-3 border-t border-clinical-border dark:border-slate-800">
                <span className="text-[10px] font-bold text-clinical-primary uppercase block">
                  Add Clinical Review Note
                </span>
                <input
                  type="text"
                  placeholder="Observation Title..."
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-clinical-border dark:border-slate-700 rounded-clinical bg-slate-50 dark:bg-slate-850 text-clinical-ink dark:text-white outline-none focus:border-clinical-primary font-medium"
                />
                <textarea
                  placeholder="Enter clinical findings, patient correlation notes, or follow-up recommendation..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-3 border border-clinical-border dark:border-slate-700 rounded-clinical bg-slate-50 dark:bg-slate-850 text-clinical-ink dark:text-white outline-none focus:border-clinical-primary font-medium"
                />
                <div className="flex justify-between items-center">
                  <select
                    value={newNoteSeverity}
                    onChange={(e) => setNewNoteSeverity(e.target.value as any)}
                    className="text-xs px-2.5 py-1.5 border border-clinical-border dark:border-slate-700 rounded-clinical bg-slate-50 dark:bg-slate-850 text-clinical-ink dark:text-white"
                  >
                    <option value="Low">Low Severity</option>
                    <option value="Medium">Medium Severity</option>
                    <option value="High">High Severity</option>
                  </select>

                  <button
                    type="submit"
                    className="min-h-[40px] px-4 py-2 bg-clinical-primary hover:bg-[#005c54] text-white text-xs font-bold rounded-clinical transition"
                  >
                    Save Note
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* SECTION E: CLINICAL GUIDANCE RECOMMENDATIONS (if supplied by analysis) */}
      {Object.keys(recommendations).length > 0 && (
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
          <div className="flex items-center gap-2 border-b border-clinical-border dark:border-slate-800 pb-2">
            <MaterialIcon name="medical_services" className="text-clinical-primary text-[20px]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-clinical-textSecondary">
              Diagnostic Guidance & Clinical Recommendations
            </h3>
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {RECOMMENDATION_CATEGORIES.filter((cat) => recommendations[cat]?.length > 0).map((category) => (
              <div
                key={category}
                className="p-3.5 rounded-clinical border border-clinical-border dark:border-slate-700 bg-slate-50 dark:bg-slate-850 space-y-2"
              >
                <span className="text-[10px] text-clinical-primary font-bold uppercase tracking-wider block border-b border-clinical-border dark:border-slate-800 pb-1">
                  {category}
                </span>
                <ul className="space-y-1.5">
                  {recommendations[category].map((item: string, idx: number) => (
                    <li key={idx} className="flex gap-1.5 text-xs text-clinical-textSecondary leading-relaxed">
                      <span className="text-clinical-primary">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION F: SCAN HISTORY TIMELINE */}
      <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-clinical-border dark:border-slate-800 text-clinical-primary">
          <MaterialIcon name="history" className="text-[20px]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-clinical-textSecondary">
            {t('dashboard_scan_history', 'Recent Scan History')}
          </h3>
        </div>

        {isTimelineLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-clinical" />
            ))}
          </div>
        ) : history.length > 0 ? (
          <div className="space-y-2.5">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-3 border border-clinical-border dark:border-slate-700 bg-slate-50 dark:bg-slate-850 rounded-clinical flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
              >
                <div>
                  <p className="font-bold text-clinical-ink dark:text-white">
                    {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-[10px] text-clinical-textSecondary uppercase font-medium mt-0.5">
                    Prediction: {formatClassName(item.prediction)} • Confidence: {Math.round(item.confidence)}%
                  </p>
                </div>
                <span className={`text-[10px] uppercase font-bold ${getStatusTextStyle(item.risk)}`}>
                  {item.risk} Risk Category
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            iconName="history"
            title="No Prior Scan History"
            description="No clinical MRI scan sessions have been archived for this user."
          />
        )}
      </div>
    </motion.div>
  );
}
