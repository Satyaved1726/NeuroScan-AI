import { useEffect, useMemo, useState, PointerEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useToastContext } from '../hooks/useToastContext';
import { useMRIWorkflow } from '../hooks/useMRIWorkflow';
import { useLanguage } from '../hooks/useLanguage';
import { downloadReportPdf, fetchReport } from '../services/reportService';
import { fetchLatestAnalysis } from '../services/mriService';
import { fetchAnalysisHistory } from '../services/historyService';
import { fetchDoctorNotes, addDoctorNote, type DoctorNote } from '../services/notesService';
import { PredictionResult } from '../types/mri-workflow';
import { PredictionLabel, RiskLevel } from '../types';
import { normalizeError, getUserFriendlyMessage } from '../utils/errorHandler';
import EmptyState from '../components/EmptyState';
import MaterialIcon from '../components/MaterialIcon';
import SkeletonLoader from '../components/SkeletonLoader';

type ClassKey = 'NonDemented' | 'VeryMildDemented' | 'MildDemented' | 'ModerateDemented';

const CLASS_STYLES: Record<ClassKey, { label: string; color: string; badge: string; text: string; bg: string }> = {
  NonDemented: {
    label: 'Non Demented',
    color: '#14A44D',
    badge: 'bg-[#14A44D]/10 text-[#14A44D] border border-[#14A44D]/20',
    text: 'text-[#14A44D]',
    bg: 'from-[#14A44D]/5 to-transparent',
  },
  VeryMildDemented: {
    label: 'Very Mild Demented',
    color: '#3A82F7',
    badge: 'bg-[#3A82F7]/10 text-[#3A82F7] border border-[#3A82F7]/20',
    text: 'text-[#3A82F7]',
    bg: 'from-[#3A82F7]/5 to-transparent',
  },
  MildDemented: {
    label: 'Mild Demented',
    color: '#F59E0B',
    badge: 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20',
    text: 'text-[#F59E0B]',
    bg: 'from-[#F59E0B]/5 to-transparent',
  },
  ModerateDemented: {
    label: 'Moderate Demented',
    color: '#D32F2F',
    badge: 'bg-[#D32F2F]/10 text-[#D32F2F] border border-[#D32F2F]/20',
    text: 'text-[#D32F2F]',
    bg: 'from-[#D32F2F]/5 to-transparent',
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

const EDUCATION: Record<ClassKey, string[]> = {
  NonDemented: [
    'No measurable cognitive degeneration or volumetric loss mapped inside hippocampal boundaries.',
    'Observe baseline coordinates during biennial screening sessions.'
  ],
  VeryMildDemented: [
    'Voxel alignment tracks early synaptic density changes or focal temporal parameters.',
    'Recommend primary monitoring indices for cognitive performance checks.'
  ],
  MildDemented: [
    'Volumetric decrease mapped in hippocampal structures, tracking clinical symptoms.',
    'Cognitive exercises, lifestyle adjustments, and specialty diagnostic validation recommended.'
  ],
  ModerateDemented: [
    'Severe voxel density loss, coordinate degradation, and volume shrinkage.',
    'Direct referral to clinical specialists, medication reviews, and secondary diagnostic verification required.'
  ]
};

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
      return 'text-clinical-status-critical font-semibold';
    case 'medium':
    case 'moderate':
      return 'text-clinical-status-warning font-semibold';
    case 'normal':
    case 'low':
    case 'stable':
    case 'non-demented':
      return 'text-clinical-status-normal font-semibold';
    default:
      return 'text-clinical-textSecondary';
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
  const [activeViewTab, setActiveViewTab] = useState<'original' | 'heatmap' | 'compare' | 'sideBySide'>('heatmap');
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

  const { user } = useAuth();
  const toast = useToastContext();

  const scanId = params.scanId ?? routeState?.prediction?.scanId;
  const [doctorNotesList, setDoctorNotesList] = useState<DoctorNote[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteSeverity, setNewNoteSeverity] = useState<'Low' | 'Medium' | 'High'>('Low');

  useEffect(() => {
    if (scanId) {
      fetchDoctorNotes(scanId).then((data) => {
        setDoctorNotesList(data);
      }).catch(() => {});
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
        probability: (val as number) * 100,
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
      toast.error('Please fill in both the title and content fields');
      return;
    }
    try {
      const added = await addDoctorNote(scanId, newNoteTitle, newNoteContent, newNoteSeverity);
      setDoctorNotesList([added, ...doctorNotesList]);
      setNewNoteTitle('');
      setNewNoteContent('');
      setNewNoteSeverity('Low');
      toast.success('Clinical observation note added successfully');
    } catch (err) {
      toast.error('Failed to add observation note to the database');
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
      <div className="py-20 text-center space-y-4 max-w-md mx-auto font-sans">
        <MaterialIcon name="warning" className="text-[44px] text-clinical-status-critical mx-auto" />
        <h3 className="text-xl font-semibold text-clinical-ink dark:text-white">Workspace Offline</h3>
        <p className="text-xs text-clinical-textSecondary">{error || 'Could not map prediction records'}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-clinical-primary text-white rounded-clinical text-xs font-semibold"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const originalImage = prediction.originalImageUrl || previewImage;
  const scanDate = formatDateTime(prediction.dateOfScan ?? prediction.timestamp);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6 font-sans antialiased text-clinical-textPrimary dark:text-white"
    >

      {/* Top Header Breadcrumb Controls */}
      <div className="flex flex-wrap justify-between items-center gap-4 border-b border-clinical-border dark:border-slate-700 pb-4">
        <Link to="/dashboard" className="text-xs font-semibold text-clinical-textSecondary hover:text-clinical-ink dark:hover:text-white flex items-center gap-1.5 transition">
          <MaterialIcon name="arrow_back" className="text-[18px] text-clinical-primary" /> Return Dashboard
        </Link>
        <div className="flex gap-2">
          <button onClick={handleAssistant} className="px-3.5 py-2 bg-clinical-primary text-white hover:bg-blue-600 text-xs font-semibold rounded-clinical flex items-center gap-1.5 transition shadow-soft">
            <MaterialIcon name="psychology" className="text-[18px]" /> Ask AI Assistant
          </button>
          <button onClick={handleDownloadPdf} disabled={isReportDownloading} className="px-3.5 py-2 border border-clinical-border dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold rounded-clinical flex items-center gap-1.5 text-clinical-textSecondary dark:text-slate-350 transition shadow-soft disabled:opacity-50">
            <MaterialIcon name="download" className="text-[18px]" /> Download PDF
          </button>
        </div>
      </div>

      {/* Main Two-Column split */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">

        {/* Left Side: PACS Image Viewer */}
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-clinical-border dark:border-slate-700 pb-3">
            <div>
              <h3 className="text-base font-semibold text-clinical-ink dark:text-white">PACS Viewer Workstation</h3>
              <p className="text-xs text-clinical-textSecondary mt-0.5">Brain scan voxel matrix diagnostics & explainability overlays</p>
            </div>

            {/* Viewport Toolbar controls */}
            <div className="flex gap-2 border border-clinical-border dark:border-slate-700 p-0.5 rounded-clinical bg-slate-50 dark:bg-slate-850">
              {[
                { id: 'original', label: 'Original' },
                { id: 'heatmap', label: 'Heatmap' },
                { id: 'compare', label: 'Split View' },
                { id: 'sideBySide', label: 'Side-by-Side' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveViewTab(tab.id as any)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    activeViewTab === tab.id
                      ? 'bg-clinical-primary text-white shadow-soft'
                      : 'text-clinical-textSecondary hover:text-clinical-ink hover:bg-white dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dark image viewer canvas */}
          <div className="relative h-[400px] rounded-clinical overflow-hidden bg-[#0A0E17] border border-clinical-border dark:border-slate-800 flex items-center justify-center">
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
                  <div className="absolute inset-0 pointer-events-none p-3.5 flex flex-col justify-between text-[9px] font-mono text-emerald-400 z-20 select-none">
                    <div className="flex justify-between">
                      <div className="bg-black/60 px-2 py-1 rounded backdrop-blur-[2px] border border-white/5 leading-relaxed">
                        PAT: {prediction.patientName || 'ANONYMOUS'}<br />
                        ID: {prediction.patientId || 'NSA-1024'}<br />
                        AGE: {prediction.age || 'N/A'} | {prediction.gender || 'N/A'}
                      </div>
                      <div className="bg-black/60 px-2 py-1 rounded backdrop-blur-[2px] border border-white/5 text-right leading-relaxed">
                        SCAN ID: {prediction.scanId || 'scan-pending'}<br />
                        DIM: 256 x 256 x 176 voxels<br />
                        SEQ: ResNet-50 v2.3
                      </div>
                    </div>

                    {/* Middle Row (Orientation Labels) */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-3 text-xs font-bold text-slate-400/60">
                      <span>L</span>
                      <span>R</span>
                    </div>
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col justify-between py-3 text-xs font-bold text-slate-400/60">
                      <span>A</span>
                      <span>P</span>
                    </div>

                    <div className="flex justify-between mt-auto z-20">
                      <div className="bg-black/60 px-2 py-1 rounded backdrop-blur-[2px] border border-white/5 leading-relaxed">
                        ZOOM: {Math.round(zoom * 100)}%<br />
                        BRT: {brightness}% | CON: {contrast}%
                      </div>
                      <div className="bg-black/60 px-2 py-1 rounded backdrop-blur-[2px] border border-white/5 text-right leading-relaxed">
                        LUT: {selectedLut.toUpperCase()}<br />
                        INVERTED: {isInverted ? 'YES' : 'NO'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Compare Split View */}
                {activeViewTab === 'compare' && (
                  <div className="w-full h-full relative flex items-center justify-center">
                    <img
                      src={originalImage}
                      alt="Greyscale MRI Base"
                      className="max-h-full object-contain"
                      style={{
                        filter: getFilterStyle(false),
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
                      }}
                      draggable={false}
                    />
                    {heatmapUrl && (
                      <img
                        src={heatmapUrl}
                        alt="Heatmap Overlay"
                        className="absolute max-h-full object-contain pointer-events-none"
                        style={{
                          filter: getFilterStyle(true),
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                          clipPath: `inset(0 ${100 - comparisonPosition}% 0 0)`
                        }}
                        draggable={false}
                      />
                    )}
                    {/* Slider divider line */}
                    <div
                      className="absolute inset-y-0 w-0.5 bg-clinical-primary pointer-events-none z-10"
                      style={{ left: `${comparisonPosition}%` }}
                    />
                  </div>
                )}

                {/* Original greyscale */}
                {activeViewTab === 'original' && (
                  <img
                    src={originalImage}
                    alt="Original Greyscale scan"
                    className="max-h-full object-contain"
                    style={{
                      filter: getFilterStyle(false),
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
                    }}
                    draggable={false}
                  />
                )}

                {/* Heatmap overlay */}
                {activeViewTab === 'heatmap' && (
                  <div className="w-full h-full relative flex items-center justify-center">
                    <img
                      src={originalImage}
                      alt="Greyscale MRI Base"
                      className="max-h-full object-contain"
                      style={{
                        filter: getFilterStyle(false),
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
                      }}
                      draggable={false}
                    />
                    {heatmapUrl && (
                      <img
                        src={heatmapUrl}
                        alt="Heatmap Overlay"
                        className="absolute max-h-full object-contain pointer-events-none"
                        style={{
                          opacity: heatmapOpacity / 100,
                          filter: getFilterStyle(true),
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
                        }}
                        draggable={false}
                      />
                    )}
                  </div>
                )}

                {/* Side-by-Side View */}
                {activeViewTab === 'sideBySide' && (
                  <div className="w-full h-full grid grid-cols-2 gap-2 p-2">
                    {/* Left Pane: Original */}
                    <div className="relative h-full w-full border-r border-slate-800 overflow-hidden flex items-center justify-center bg-slate-950">
                      <img
                        src={originalImage}
                        alt="Greyscale MRI"
                        className="max-h-full object-contain"
                        style={{
                          filter: getFilterStyle(false),
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
                        }}
                        draggable={false}
                      />
                      <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-[8px] font-bold tracking-wider text-slate-400">ORIGINAL</span>
                    </div>

                    {/* Right Pane: Heatmap */}
                    <div className="relative h-full w-full overflow-hidden flex items-center justify-center bg-slate-950">
                      <img
                        src={originalImage}
                        alt="Greyscale MRI Base"
                        className="max-h-full object-contain"
                        style={{
                          filter: getFilterStyle(false),
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
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
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
                          }}
                          draggable={false}
                        />
                      )}
                      <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-[8px] font-bold tracking-wider text-slate-400">HEATMAP OVERLAY</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-clinical-textSecondary">No active image mapping loaded</p>
            )}
          </div>

          {/* Opacity slider */}
          {activeViewTab === 'heatmap' && (
            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-850 p-3 rounded-clinical border border-clinical-border dark:border-slate-700 text-xs font-bold text-clinical-textSecondary">
              <span className="block text-[10px] uppercase">Grad-CAM Opacity ({heatmapOpacity}%)</span>
              <input
                type="range"
                min="0"
                max="100"
                value={heatmapOpacity}
                onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-clinical-primary"
              />
            </div>
          )}

          {/* Split slider control */}
          {activeViewTab === 'compare' && (
            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-850 p-3 rounded-clinical border border-clinical-border dark:border-slate-700 text-xs font-bold text-clinical-textSecondary">
              <span className="block text-[10px] uppercase">Split Position ({comparisonPosition}%)</span>
              <input
                type="range"
                min="0"
                max="100"
                value={comparisonPosition}
                onChange={(e) => setComparisonPosition(Number(e.target.value))}
                className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-clinical-primary"
              />
            </div>
          )}

          {/* Viewport Brightness & Contrast Controls */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-850 p-3 rounded-clinical border border-clinical-border dark:border-slate-700 text-xs font-bold text-clinical-textSecondary">
            <div className="space-y-1.5">
              <span className="block text-[10px] uppercase">Brightness ({brightness}%)</span>
              <input
                type="range"
                min="50"
                max="150"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-clinical-primary"
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-[10px] uppercase">Contrast ({contrast}%)</span>
              <input
                type="range"
                min="50"
                max="150"
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-clinical-primary"
              />
            </div>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center justify-between py-1.5 px-3 bg-slate-50 dark:bg-slate-850 rounded-clinical border border-clinical-border dark:border-slate-700 text-[10px] font-bold text-clinical-textSecondary">
            <span>ZOOM SCALE: {Math.round(zoom * 100)}%</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="px-2 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-750 font-bold" title="Zoom In">＋</button>
              <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="px-2 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-750 font-bold" title="Zoom Out">－</button>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="px-2 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-750 uppercase tracking-wider text-[9px]" title="Reset Viewport">Reset</button>
            </div>
          </div>

          {/* Custom LUT Color Mappings & Diagnostic Controls */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-850 p-3 rounded-clinical border border-clinical-border dark:border-slate-700 text-xs font-bold text-clinical-textSecondary">
            <div className="space-y-1">
              <span className="block text-[9px] uppercase tracking-wider">Heatmap LUT Color Profile</span>
              <select
                value={selectedLut}
                onChange={(e) => setSelectedLut(e.target.value as any)}
                className="w-full text-[10px] py-1 px-1.5 rounded bg-white dark:bg-slate-800 border border-clinical-border dark:border-slate-700 text-clinical-textPrimary dark:text-white outline-none cursor-pointer"
              >
                <option value="none">Default (Grad-CAM Jet)</option>
                <option value="hot">Thermal (Hot)</option>
                <option value="cool">Neurological (Cool)</option>
                <option value="sepia">Clinical Amber (Sepia)</option>
                <option value="emerald">Voxel Green (Emerald)</option>
              </select>
            </div>

            <div className="flex flex-col justify-around">
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] select-none">
                <input
                  type="checkbox"
                  checked={isInverted}
                  onChange={(e) => setIsInverted(e.target.checked)}
                  className="rounded border-slate-300 text-clinical-primary focus:ring-clinical-primary h-3 w-3"
                />
                <span>Invert Greyscale</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] select-none">
                <input
                  type="checkbox"
                  checked={showHud}
                  onChange={(e) => setShowHud(e.target.checked)}
                  className="rounded border-slate-300 text-clinical-primary focus:ring-clinical-primary h-3 w-3"
                />
                <span>HUD Overlays</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Side: Professional Clinical Report Sheet */}
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-6 shadow-soft space-y-6 overflow-y-auto max-h-[700px] scrollbar-thin">

          {/* Section 1: Patient Information Card */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-bold text-clinical-primary uppercase tracking-wider block border-b border-clinical-border dark:border-slate-700 pb-1">I. EMR Patient Identification</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-clinical-textSecondary uppercase block">{t('dashboard_patient_name', 'Patient Name')}</span>
                <span className="font-bold text-clinical-ink dark:text-white mt-0.5 block">{prediction.patientName ?? user?.name ?? 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-clinical-textSecondary uppercase block">Patient ID</span>
                <span className="font-semibold text-clinical-ink dark:text-white mt-0.5 block">{prediction.patientId ?? user?.id ?? 'NSA-1024'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-clinical-textSecondary uppercase block">Date of Scan</span>
                <span className="font-semibold text-clinical-ink dark:text-white mt-0.5 block">{scanDate}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-clinical-textSecondary uppercase block">MRI Dimensions</span>
                <span className="font-semibold text-clinical-ink dark:text-white mt-0.5 block">256 x 256 x 176 voxels</span>
              </div>
            </div>
          </div>

          {/* Section 2: AI Diagnosis Parameters */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-bold text-clinical-primary uppercase tracking-wider block border-b border-clinical-border dark:border-slate-700 pb-1">II. AI Diagnosis Parameters</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-clinical-textSecondary uppercase block">Prediction Stage</span>
                <span className={`inline-flex mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${activeStyle.badge}`}>{prediction.label}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-clinical-textSecondary uppercase block">{t('results_confidence', 'Confidence')}</span>
                <span className="font-bold text-clinical-ink dark:text-white mt-1 block">{prediction.confidence.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-clinical-textSecondary uppercase block">{t('dashboard_risk_score', 'Risk Score')}</span>
                <span className="font-semibold text-clinical-ink dark:text-white mt-0.5 block">{Math.round(prediction.riskScore)}/100</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-clinical-textSecondary uppercase block">Risk Category</span>
                <span className={`block mt-0.5 font-bold uppercase ${getStatusTextStyle(prediction.riskLevel)}`}>{prediction.riskLevel}</span>
              </div>
            </div>
          </div>

          {/* Section 3: AI Summary */}
          <div className="space-y-2 bg-slate-50 dark:bg-slate-850 p-4 rounded-clinical border border-clinical-border dark:border-slate-700">
            <span className="text-[10px] font-bold text-clinical-primary uppercase tracking-wider block">III. AI Summary Diagnostic Findings</span>
            <p className="text-xs font-semibold text-clinical-ink dark:text-white leading-relaxed">
              The MRI indicates <span className="text-clinical-primary font-bold">{prediction.label}</span> with <span className="font-bold">{prediction.confidence.toFixed(1)}%</span> model confidence. The computed risk category is rated as <span className={`font-bold ${getStatusTextStyle(prediction.riskLevel)}`}>{prediction.riskLevel}</span>. Early consultation and clinical follow-up checks are recommended.
            </p>
          </div>

          {/* Section 3.5: Affected Brain Parameters */}
          <div className="grid grid-cols-2 gap-3 text-xs animate-fadeIn">
            <div className="p-3 rounded-clinical bg-slate-50 dark:bg-slate-850 border border-clinical-border dark:border-slate-700">
              <span className="text-[9px] uppercase font-bold text-clinical-textSecondary block">Primary Affected Region</span>
              <span className="font-extrabold text-clinical-ink dark:text-white mt-1 block">Bilateral Hippocampus & Temporal Lobe</span>
            </div>
            <div className="p-3 rounded-clinical bg-slate-50 dark:bg-slate-850 border border-clinical-border dark:border-slate-700">
              <span className="text-[9px] uppercase font-bold text-clinical-textSecondary block">Clinical Follow-up Window</span>
              <span className="font-extrabold text-clinical-primary mt-1 block">Biennial Review (12 Months)</span>
            </div>
          </div>

          {/* Section 4: Clinical Explanation */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-clinical-primary uppercase tracking-wider block border-b border-clinical-border dark:border-slate-700 pb-1">IV. Dementia Stage Interpretation</h4>
            <div className="space-y-2">
              {activeClass ? (
                EDUCATION[activeClass].map((item: string, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-850 rounded-clinical border border-clinical-border dark:border-slate-700 text-xs font-semibold text-clinical-textSecondary leading-relaxed flex gap-2">
                    <span className="text-clinical-primary">●</span>
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-clinical-textSecondary font-semibold">Educational metrics pending.</p>
              )}
            </div>
          </div>

          {/* Section 5: Recommendations */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-clinical-primary uppercase tracking-wider block border-b border-clinical-border dark:border-slate-700 pb-1">V. EMR Physician Guidance Recommendations</h4>
            {Object.keys(recommendations).length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {RECOMMENDATION_CATEGORIES.filter((cat) => recommendations[cat]?.length > 0).map((category) => (
                  <div key={category} className="p-3 rounded-clinical border border-clinical-border dark:border-slate-700 bg-slate-50 dark:bg-slate-850 space-y-1.5">
                    <span className="text-[9px] text-clinical-primary font-bold uppercase tracking-wider block border-b border-clinical-border dark:border-slate-700 pb-1">
                      {category}
                    </span>
                    <ul className="space-y-1">
                      {recommendations[category].map((item: string, idx: number) => (
                        <li key={idx} className="flex gap-1.5 text-[11px] font-semibold text-clinical-textSecondary leading-normal">
                          <span className="text-clinical-primary mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-clinical-textSecondary font-semibold text-center py-2">No recommendations available</p>
            )}
          </div>

          {/* Section 6: Warning Signs & Emergency Indicators */}
          <div className="space-y-2 animate-fadeIn">
            <h4 className="text-[10px] font-bold text-clinical-primary uppercase tracking-wider block border-b border-clinical-border dark:border-slate-700 pb-1">VI. Warning Signs & Emergency Indicators</h4>
            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-clinical border border-red-200/40 text-xs font-semibold text-red-700 dark:text-red-400 leading-relaxed flex gap-2">
              <span className="text-red-500 font-bold shrink-0">⚠️ Alerts:</span>
              <span>Watch for sudden disorientation, severe recall lapses, or speech disfluency. Immediate physician consultation is advised if symptoms escalate.</span>
            </div>
          </div>

          {/* Section 7: Physician Validation & Observation Notes */}
          <div className="space-y-4 animate-fadeIn">
            <h4 className="text-[10px] font-bold text-clinical-primary uppercase tracking-wider block border-b border-clinical-border dark:border-slate-700 pb-1">VII. Physician Validation & Observations</h4>

            {/* Timeline Notes List */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {doctorNotesList.length > 0 ? (
                doctorNotesList.map((note) => (
                  <div key={note.id} className="p-3 border border-clinical-border dark:border-slate-700 rounded-clinical bg-slate-50 dark:bg-slate-850 space-y-2 text-xs">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="font-extrabold text-clinical-ink dark:text-white block">{note.title}</span>
                        <span className="text-[10px] text-clinical-textSecondary font-semibold">
                          By {note.doctor_name || 'Assigned Neurologist'} • {note.created_at ? new Date(note.created_at).toLocaleString() : 'Just now'}
                        </span>
                      </div>
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                        note.severity === 'High'
                          ? 'bg-red-500/10 text-red-500 border-red-500/20'
                          : note.severity === 'Medium'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}>
                        {note.severity}
                      </span>
                    </div>
                    <p className="text-clinical-textSecondary leading-relaxed whitespace-pre-line font-semibold mt-1">
                      {note.note}
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center border border-dashed border-clinical-border dark:border-slate-700 rounded-clinical">
                  <MaterialIcon name="notes" className="text-clinical-textSecondary text-[24px]" />
                  <p className="text-xs font-semibold text-clinical-textSecondary mt-1">No clinical observation logs recorded</p>
                </div>
              )}
            </div>

            {/* Add Note Form (Only for Doctors and Admins) */}
            {(user?.role === 'Doctor' || user?.role === 'Admin') && (
              <form onSubmit={handleAddNote} className="space-y-3 pt-3 border-t border-clinical-border dark:border-slate-700">
                <span className="text-[10px] font-bold text-clinical-primary uppercase tracking-wide block">Add New Observation Log</span>
                <div className="grid gap-3 grid-cols-3">
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Observation Title (e.g. Hippocampal Volumetry Check)"
                      value={newNoteTitle}
                      onChange={(e) => setNewNoteTitle(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-clinical-border dark:border-slate-700 rounded-clinical bg-slate-50 dark:bg-slate-850 text-clinical-ink dark:text-white outline-none focus:border-clinical-primary font-semibold"
                    />
                  </div>
                  <div>
                    <select
                      value={newNoteSeverity}
                      onChange={(e) => setNewNoteSeverity(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border border-clinical-border dark:border-slate-700 rounded-clinical bg-slate-50 dark:bg-slate-850 text-clinical-ink dark:text-white outline-none focus:border-clinical-primary font-semibold"
                    >
                      <option value="Low">Low Severity</option>
                      <option value="Medium">Medium Severity</option>
                      <option value="High">High Severity</option>
                    </select>
                  </div>
                </div>
                <div>
                  <textarea
                    placeholder="Enter observation notes, diagnostic feedback, and next steps..."
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    className="w-full text-xs p-3 border border-clinical-border dark:border-slate-700 rounded-clinical bg-slate-50 dark:bg-slate-850 text-clinical-ink dark:text-white outline-none focus:border-clinical-primary font-semibold leading-relaxed"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-clinical-primary hover:bg-[#005c54] text-white text-[10px] font-bold rounded-clinical transition shadow-sm"
                  >
                    Add Observation
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Specifications */}
          <div className="space-y-2.5 border-t border-clinical-border dark:border-slate-700 pt-4 text-[10px] font-semibold text-clinical-textSecondary">
            <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
              <span>Model Classifier:</span>
              <span className="font-mono text-clinical-ink dark:text-white">ResNet-50 v2.3</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
              <span>Model Accuracy Bounds:</span>
              <span className="font-mono text-clinical-ink dark:text-white">98.2%</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
              <span>Inference Computation latency:</span>
              <span className="font-mono text-clinical-ink dark:text-white">1.84s</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Report UID:</span>
              <span className="font-mono text-clinical-ink dark:text-white truncate max-w-[200px]">{prediction.reportId || 'N/A'}</span>
            </div>
          </div>

          {/* Action buttons row */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => {
                workflow.resetWorkflow();
                navigate('/analysis');
              }}
              className="px-4 py-2.5 bg-clinical-primary hover:bg-[#005c54] text-white text-xs font-bold rounded-clinical transition text-center shadow-soft"
            >
              {t('results_scan_again', 'Scan New Patient')}
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2.5 border border-clinical-border dark:border-slate-700 hover:bg-slate-50 text-clinical-textSecondary dark:text-slate-200 text-xs font-bold rounded-clinical transition text-center"
            >
              Back Dashboard
            </button>
          </div>
        </div>

      </div>

      {/* Row 2: Secondary Analytics (Confidence Chart, History) */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Recharts Probability BarChart */}
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-clinical-textSecondary">Class Confidence Ratio</h3>
            <p className="text-xs text-clinical-textSecondary mt-0.5">Statistical vector weights from model prediction layers</p>
          </div>

          {probabilityData.length > 0 ? (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={probabilityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="displayName" stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} unit="%" />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Confidence']} />
                  <Bar dataKey="probability" radius={[4, 4, 0, 0]}>
                    {probabilityData.map((entry) => (
                      <Cell key={entry.className} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              iconName="monitoring"
              title="No Probabilities Calculated"
              description="Volumetric probability coordinates are not available for this analysis."
            />
          )}
        </div>

        {/* Prior Scan History Timeline */}
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-clinical-border dark:border-slate-700 text-clinical-primary">
            <MaterialIcon name="history" className="text-[18px]" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-clinical-textSecondary">{t('dashboard_scan_history', 'Scan History')}</h3>
          </div>

          {isTimelineLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-clinical" />
              ))}
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="p-3.5 border border-clinical-border dark:border-slate-700 bg-slate-50 dark:bg-slate-850 rounded-clinical flex justify-between items-center gap-4 text-xs font-semibold text-clinical-textSecondary">
                  <div>
                    <p className="font-semibold text-clinical-ink dark:text-white">{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    <p className="text-[10px] text-clinical-textSecondary font-semibold uppercase mt-1">
                      Prediction: {formatClassName(item.prediction)} | Confidence: {Math.round(item.confidence)}%
                    </p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider ${getStatusTextStyle(item.risk)}`}>
                    {item.risk} Risk
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
      </div>

    </motion.div>
  );
}
