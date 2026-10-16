import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMRIWorkflow } from '../hooks/useMRIWorkflow';
import { useToastContext } from '../hooks/useToastContext';
import { useLanguage } from '../hooks/useLanguage';
import MaterialIcon from '../components/MaterialIcon';

export default function UploadPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const workflow = useMRIWorkflow();
  const { state } = workflow;
  const toast = useToastContext();
  const { t } = useLanguage();

  // Reset workflow unconditionally on mount, to prepare for a fresh upload
  useEffect(() => {
    workflow.resetWorkflow();
  }, []);

  const [dragActive, setDragActive] = useState(false);
  const [scanNotes, setScanNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const previousStepRef = useRef(state.currentStep);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal log to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.currentStep, state.uploadProgress, state.analysisProgress]);

  // Effect to handle redirect after successful analysis
  useEffect(() => {
    const completedDuringThisVisit = previousStepRef.current !== 'success' && state.currentStep === 'success';
    const prediction = state.prediction;

    if (completedDuringThisVisit && prediction?.scanId) {
      const timer = setTimeout(() => {
        navigate(`/results/${prediction.scanId}`, {
          state: { prediction: prediction, preview: state.file?.preview },
        });
      }, 1500);
      return () => clearTimeout(timer);
    }

    previousStepRef.current = state.currentStep;
  }, [state.currentStep, state.file?.preview, state.prediction, navigate]);

  useEffect(() => {
    previousStepRef.current = state.currentStep;
  }, [location.key]);

  // Handle drag and drop
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      dragCounterRef.current++;
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setDragActive(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File size exceeds 15MB limit.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const preview = reader.result as string;
      await workflow.uploadFile(file, preview);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const generateLogs = () => {
    const logs = [];
    logs.push('[SYSTEM] Ready. Select patient and upload MRI scan payload.');

    if (state.file) {
      logs.push(`[SYSTEM] Loaded file: ${state.file.name} (${(state.file.size / 1024 / 1024).toFixed(2)} MB)`);
    }

    if (state.currentStep === 'uploading') {
      logs.push(`[PIPELINE] Uploading raw payload: ${state.uploadProgress}%`);
    }

    if (state.currentStep === 'validating') {
      logs.push('[PIPELINE] Initializing DICOM quality validators...');
      state.qualityChecks.forEach((c) => {
        logs.push(`[CHECK] ${c.label} -> ${c.status.toUpperCase()}: ${c.message}`);
      });
    }

    if (state.currentStep === 'preprocessing') {
      logs.push('[PIPELINE] Launching voxel preprocessing algorithms...');
      state.preprocessingSteps.forEach((s) => {
        logs.push(`[PROCESS] ${s.name} (${s.progress}%) -> ${s.status.toUpperCase()}`);
      });
    }

    if (state.currentStep === 'analyzing') {
      logs.push(`[PIPELINE] Running ResNet-50 dementia classification nodes: ${state.analysisProgress}%`);
    }

    if (state.currentStep === 'success') {
      logs.push('[SYSTEM] Diagnostic model completed execution successfully.');
      if (state.prediction) {
        logs.push(`[RESULT] Stage Classification: ${state.prediction.label}`);
        logs.push(`[RESULT] Prediction Confidence: ${state.prediction.confidence.toFixed(1)}%`);
        logs.push(`[RESULT] Computed Risk Vector: ${state.prediction.riskLevel} (${Math.round(state.prediction.riskScore)}/100)`);
      }
    }

    if (state.currentStep === 'error') {
      logs.push(`[ERROR] Pipeline aborted: ${state.error}`);
    }

    return logs;
  };

  const stepsList = [
    { key: 'uploading', label: t('upload_step_1', 'Uploading MRI') },
    { key: 'validating', label: t('upload_step_2', 'Validating File') },
    { key: 'preprocessing', label: t('upload_step_3', 'Preprocessing MRI') },
    { key: 'analyzing', label: t('upload_step_4', 'Running CNN Model') },
    { key: 'heatmap', label: t('upload_step_5', 'Generating Heatmap') },
    { key: 'saving', label: t('upload_step_6', 'Preparing Clinical Report') },
    { key: 'success', label: t('confirm_ok', 'Proceed') },
  ];

  const getStepStatus = (stepKey: string) => {
    const stepsOrder = ['idle', 'uploading', 'validating', 'preprocessing', 'analyzing', 'heatmap', 'saving', 'success'];
    const currentIdx = stepsOrder.indexOf(state.currentStep);
    const stepIdx = stepsOrder.indexOf(stepKey);

    if (state.currentStep === 'error') {
      return 'pending';
    }

    if (currentIdx > stepIdx) return 'completed';
    if (currentIdx === stepIdx) return 'active';
    return 'pending';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6 max-w-5xl mx-auto font-sans antialiased text-clinical-ink dark:text-white"
    >

      {/* Title Header */}
      <div className="border-b border-clinical-border dark:border-slate-700 pb-4">
        <h2 className="text-2xl font-bold">{t('upload_title', 'Upload Brain MRI')}</h2>
        <p className="text-xs text-clinical-textSecondary mt-0.5">{t('upload_desc', 'Drag and drop brain MRI image files to start CNN classification')}</p>
      </div>

      {/* Horizontal Status Pipeline */}
      {state.currentStep !== 'idle' && (
        <div className="border border-clinical-border dark:border-slate-700 rounded-clinical p-5 bg-white dark:bg-[#1E293B] shadow-soft space-y-4">
          <span className="text-[10px] uppercase font-bold text-clinical-textSecondary block pb-1 border-b border-slate-50 dark:border-slate-800">MRI Pipeline Milestones</span>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-2">
            {stepsList.map((step, idx) => {
              const status = getStepStatus(step.key);
              return (
                <div key={step.key} className="flex-1 flex items-center gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                      status === 'completed'
                        ? 'bg-clinical-status-normal/10 text-clinical-status-normal border-clinical-status-normal/35'
                        : status === 'active'
                        ? 'bg-clinical-primary text-white border-clinical-primary animate-pulse'
                        : 'bg-slate-50 dark:bg-slate-800 text-clinical-textSecondary border-clinical-border dark:border-slate-700'
                    }`}>
                      {status === 'completed' ? (
                        <MaterialIcon name="check" className="text-[10px] font-bold" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span className={`text-[11px] font-bold truncate ${
                      status === 'completed'
                        ? 'text-clinical-status-normal'
                        : status === 'active'
                        ? 'text-clinical-primary'
                        : 'text-clinical-textSecondary'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < stepsList.length - 1 && (
                    <div className="hidden md:block flex-1 h-px bg-clinical-border dark:bg-slate-700 mx-2" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error alert banner */}
      {state.error && (
        <div className="p-4 rounded-clinical border border-clinical-status-critical/20 bg-clinical-status-critical/5 flex gap-3 text-xs">
          <MaterialIcon name="warning" className="text-[18px] text-clinical-status-critical shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-clinical-status-critical block">Pipeline Warning</span>
            <p className="text-clinical-status-critical mt-1 font-semibold">{state.error}</p>
            <button
              onClick={workflow.resetWorkflow}
              className="mt-3 px-3 py-1.5 bg-clinical-status-critical hover:bg-red-700 text-white font-semibold rounded-clinical transition"
            >
              Reset Session
            </button>
          </div>
        </div>
      )}

      {/* Split layout: Upload Area & Patient Notes */}
      <div className="grid gap-6 md:grid-cols-[1.3fr_0.7fr]">

        {/* Left Side: Upload drag and drop */}
        <div className="space-y-4">

          {/* Main Upload Box */}
          {state.currentStep === 'idle' && (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-14 border-2 border-dashed rounded-clinical text-center cursor-pointer transition bg-white dark:bg-[#1E293B] hover:bg-[#EEF5FF]/10 ${
                dragActive ? 'border-clinical-primary bg-[#EEF5FF]/30' : 'border-clinical-border dark:border-slate-700'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.dcm"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <MaterialIcon name="upload_file" className="text-[44px] text-clinical-primary mx-auto mb-3" />
              <h3 className="text-sm font-bold text-clinical-ink dark:text-white">{t('upload_title', 'Upload Brain MRI')}</h3>
              <p className="text-xs text-clinical-textSecondary mt-1">Drag and drop file here, or click to browse local files</p>
              <p className="text-[10px] text-clinical-textSecondary mt-4.5">Supported standard files: PNG, JPEG, DICOM (.dcm) • Limit 15MB</p>
            </div>
          )}

          {/* Active processing workflow (Standard progress bar) */}
          {state.currentStep !== 'idle' && (
            <div className="p-6 rounded-clinical bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 space-y-5">
              {state.currentStep === 'success' ? (
                <div className="flex flex-col items-center justify-center py-6 space-y-4 animate-success-pop">
                  <div className="h-16 w-16 rounded-full bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center border border-green-500/30">
                    <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <motion.path
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div className="text-center space-y-1">
                    <h3 className="text-sm font-bold text-green-600 dark:text-green-400">Diagnostic Pipeline Succeeded</h3>
                    <p className="text-[10px] text-clinical-textSecondary font-semibold">Anonymized scan matrix saved. Redirecting to workspace...</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-clinical bg-[#EEF5FF] dark:bg-slate-800 text-clinical-primary border border-clinical-border dark:border-slate-700">
                      <MaterialIcon name="image" className="text-[24px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-clinical-ink dark:text-white truncate">{state.file?.name}</p>
                      <p className="text-[10px] text-clinical-textSecondary font-mono mt-0.5">Size: {((state.file?.size ?? 0) / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    {state.currentStep !== 'error' && (
                      <button
                        onClick={workflow.resetWorkflow}
                        className="p-1 text-clinical-textSecondary hover:text-clinical-status-critical hover:bg-slate-100 dark:hover:bg-slate-800 rounded-clinical"
                        title="Abort analysis"
                      >
                        <MaterialIcon name="close" className="text-[18px]" />
                      </button>
                    )}
                  </div>

                  {/* Progress feedback percentage */}
                  <div className="border-t border-clinical-border dark:border-slate-700 pt-4 space-y-3.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-clinical-textPrimary dark:text-white flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-clinical-primary animate-ping" />
                        Pipeline status: {state.currentStep}
                      </span>
                      <span className="font-bold font-mono text-clinical-primary">
                        {state.currentStep === 'uploading' ? `${state.uploadProgress}%` : 'In Progress'}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-clinical-primary transition-all duration-200"
                        style={{
                          width: `${
                            state.currentStep === 'uploading' ? state.uploadProgress : 50
                          }%`
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Scan details & Notes */}
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
          <div>
            <h3 className="text-sm font-bold text-clinical-ink dark:text-white">Workspace Details</h3>
            <p className="text-xs text-clinical-textSecondary mt-0.5">Institutional EMR data link parameters</p>
          </div>

          <div className="space-y-3.5">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary mb-1.5">{t('upload_notes', 'Scan Clinical Notes')}</span>
              <textarea
                value={scanNotes}
                onChange={(e) => setScanNotes(e.target.value)}
                placeholder={t('upload_notes_placeholder', 'Enter patient diagnostic history or observation notes...')}
                className="w-full h-24 border border-clinical-border dark:border-slate-700 rounded-clinical p-3 text-xs focus:border-clinical-primary focus:ring-0 bg-white dark:bg-[#1E293B] placeholder-slate-400 font-semibold"
                disabled={state.currentStep !== 'idle'}
              />
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-clinical border border-clinical-border dark:border-slate-700 text-[10px] text-clinical-textSecondary space-y-1.5 font-sans leading-relaxed">
              <span className="font-bold text-clinical-textPrimary dark:text-white uppercase tracking-wider block">Security Protocol</span>
              <p className="font-semibold text-clinical-textSecondary">
                All uploaded scan matrix grids are parsed inside a HIPAA-compliant sandbox. Voxel parameters are anonymized prior to deep learning classification.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Row 4: Workspace Diagnostics terminal console */}
      <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-3">
        <div className="flex items-center justify-between border-b border-clinical-border dark:border-slate-700 pb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-clinical-textSecondary font-sans">Workspace Diagnostics Transcript</h3>
          <span className="h-2 w-2 bg-[#16A34A] rounded-full animate-pulse" />
        </div>

        <div className="h-44 overflow-y-auto bg-slate-50 dark:bg-slate-900 border border-clinical-border dark:border-slate-800 rounded-clinical p-4 font-mono text-[11px] text-clinical-textPrimary leading-normal space-y-1.5">
          {generateLogs().map((log, idx) => (
            <div key={idx} className="border-b border-slate-105 dark:border-slate-800 pb-1 last:border-0">
              <span className="text-clinical-primary font-bold mr-1">&gt;</span> {log}
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
      </div>

    </motion.div>
  );
}
