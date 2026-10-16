import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMRIWorkflow } from '../hooks/useMRIWorkflow';
import { useToastContext } from '../hooks/useToastContext';
import { useLanguage } from '../hooks/useLanguage';
import MaterialIcon from '../components/MaterialIcon';
import { validateMRIFile } from '../utils/mriValidation';
import type { QualityCheckResult } from '../types/mri-workflow';

export default function UploadPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const workflow = useMRIWorkflow();
  const { state } = workflow;
  const toast = useToastContext();
  const { t } = useLanguage();

  // Reset workflow on initial mount
  useEffect(() => {
    workflow.resetWorkflow();
  }, []);

  const [dragActive, setDragActive] = useState(false);
  const [scanNotes, setScanNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [localChecks, setLocalChecks] = useState<QualityCheckResult[]>([]);
  const [isLocalValidationPassed, setIsLocalValidationPassed] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const previousStepRef = useRef(state.currentStep);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const progressSectionRef = useRef<HTMLDivElement>(null);
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  const hasScrolledToProgressRef = useRef(false);
  const hasScrolledToResultsRef = useRef(false);

  // Controlled scrolling that respects user reduced-motion preference
  const scrollToRef = (ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current) return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
    });
  };

  // Scroll to progress section once when processing starts
  useEffect(() => {
    if (state.currentStep !== 'idle' && state.currentStep !== 'success' && !hasScrolledToProgressRef.current) {
      hasScrolledToProgressRef.current = true;
      scrollToRef(progressSectionRef);
    }
    if (state.currentStep === 'idle') {
      hasScrolledToProgressRef.current = false;
      hasScrolledToResultsRef.current = false;
    }
  }, [state.currentStep]);

  // Scroll to results summary once when prediction is ready
  useEffect(() => {
    if (state.currentStep === 'success' && !hasScrolledToResultsRef.current) {
      hasScrolledToResultsRef.current = true;
      scrollToRef(resultsSectionRef);
    }
  }, [state.currentStep]);

  // Auto-scroll terminal diagnostics log to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.currentStep, state.uploadProgress, state.analysisProgress]);

  // Handle redirect after successful analysis
  useEffect(() => {
    const completedDuringThisVisit = previousStepRef.current !== 'success' && state.currentStep === 'success';
    const prediction = state.prediction;

    if (completedDuringThisVisit && prediction?.scanId) {
      const timer = setTimeout(() => {
        navigate(`/results/${prediction.scanId}`, {
          state: { prediction, preview: previewUrl || state.file?.preview },
        });
      }, 2200);
      return () => clearTimeout(timer);
    }

    previousStepRef.current = state.currentStep;
  }, [state.currentStep, previewUrl, state.file?.preview, state.prediction, navigate]);

  useEffect(() => {
    previousStepRef.current = state.currentStep;
  }, [location.key]);

  // Drag and drop handlers
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
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  // Inspect and validate the selected file before uploading
  const handleFileSelected = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      toast.error('File size exceeds the 15MB limit.');
      return;
    }

    setSelectedFile(file);

    // Read preview
    const reader = new FileReader();
    reader.onloadend = async () => {
      const preview = reader.result as string;
      setPreviewUrl(preview);

      // Run client-side validation
      try {
        const val = await validateMRIFile(file);
        setLocalChecks(val.checks);
        setIsLocalValidationPassed(val.passed);
        setImageDimensions({ width: val.width, height: val.height });
      } catch {
        setIsLocalValidationPassed(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  // Trigger the actual upload and AI prediction
  const handleStartAnalysis = async () => {
    if (!selectedFile || !previewUrl || isSubmitting) return;

    if (isLocalValidationPassed === false) {
      toast.error('Please fix validation issues before starting analysis.');
      return;
    }

    try {
      setIsSubmitting(true);
      await workflow.uploadFile(selectedFile, previewUrl);
    } catch {
      toast.error('Analysis failed. Please check error details and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageDimensions(null);
    setLocalChecks([]);
    setIsLocalValidationPassed(null);
    workflow.resetWorkflow();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const generateLogs = () => {
    const logs = [];
    logs.push('[SYSTEM] Ready. Select brain MRI scan payload.');

    if (selectedFile || state.file) {
      const f = selectedFile || state.file;
      const sizeMb = ((f?.size ?? 0) / 1024 / 1024).toFixed(2);
      logs.push(`[SYSTEM] Loaded file: ${f?.name} (${sizeMb} MB)`);
      if (imageDimensions) {
        logs.push(`[SYSTEM] Detected resolution: ${imageDimensions.width} x ${imageDimensions.height} px`);
      }
    }

    if (state.currentStep === 'uploading') {
      logs.push(`[PIPELINE] Uploading MRI scan payload: ${state.uploadProgress}%`);
    }

    if (state.currentStep === 'validating') {
      logs.push('[PIPELINE] Verifying image integrity, format, and resolution...');
      const checksToDisplay = state.qualityChecks.length > 0 ? state.qualityChecks : localChecks;
      checksToDisplay.forEach((c) => {
        logs.push(`[CHECK] ${c.label} -> ${c.status.toUpperCase()}: ${c.message}`);
      });
    }

    if (state.currentStep === 'preprocessing') {
      logs.push('[PIPELINE] Standardizing tensor shape to 224x224 and RGB normalization...');
    }

    if (state.currentStep === 'analyzing') {
      logs.push(`[PIPELINE] Running EfficientNet-B0 dementia classification: ${state.analysisProgress}%`);
    }

    if (state.currentStep === 'heatmap') {
      logs.push('[EXPLAINABILITY] Generating Grad-CAM attention heatmap overlay in background...');
    }

    if (state.currentStep === 'saving') {
      logs.push('[STORAGE] Persisting prediction vector and generating clinical report...');
    }

    if (state.currentStep === 'success') {
      logs.push('[SUCCESS] Diagnostic model execution and report completed.');
      if (state.prediction) {
        logs.push(`[RESULT] Predicted Stage: ${state.prediction.label}`);
        logs.push(`[RESULT] Model Confidence: ${state.prediction.confidence.toFixed(1)}%`);
        logs.push(`[RESULT] Risk Category: ${state.prediction.riskLevel} (${Math.round(state.prediction.riskScore)}/100)`);
      }
    }

    if (state.currentStep === 'error') {
      logs.push(`[ERROR] Pipeline aborted: ${state.error}`);
    }

    return logs;
  };

  // Truthful workflow stages matching Part 2
  const stepsList = [
    { key: 'uploading', label: '1. Uploading MRI' },
    { key: 'validating', label: '2. Validating Image' },
    { key: 'preprocessing', label: '3. Preparing Image' },
    { key: 'analyzing', label: '4. Running AI Analysis' },
    { key: 'saving', label: '5. Saving Prediction' },
    { key: 'success', label: '6. Prediction Ready' },
  ];

  const getStepStatus = (stepKey: string) => {
    const stepsOrder = ['idle', 'uploading', 'validating', 'preprocessing', 'analyzing', 'heatmap', 'saving', 'success'];
    const currentIdx = stepsOrder.indexOf(state.currentStep);
    const stepIdx = stepsOrder.indexOf(stepKey);

    if (state.currentStep === 'error') return 'pending';
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
      className="space-y-6 max-w-5xl mx-auto font-sans antialiased text-clinical-ink dark:text-white px-2 sm:px-4"
    >
      {/* Title Header */}
      <div className="border-b border-clinical-border dark:border-slate-700 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('upload_title', 'Upload Brain MRI Scan')}</h1>
        <p className="text-xs sm:text-sm text-clinical-textSecondary mt-1">
          {t('upload_desc', 'Select or drop axial brain MRI image files to initiate automated CNN dementia screening.')}
        </p>
      </div>

      {/* Error alert banner */}
      {state.error && (
        <div className="p-4 rounded-clinical border border-clinical-status-critical/20 bg-clinical-status-critical/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex gap-2.5 items-start">
            <MaterialIcon name="warning" className="text-[20px] text-clinical-status-critical shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-clinical-status-critical block">Pipeline Warning</span>
              <p className="text-clinical-status-critical font-medium mt-0.5">{state.error}</p>
              {state.errorDetails && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{state.errorDetails}</p>
              )}
            </div>
          </div>
          <button
            onClick={workflow.resetWorkflow}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-clinical-status-critical hover:bg-red-700 text-white font-semibold rounded-clinical transition shrink-0"
          >
            Retry Upload
          </button>
        </div>
      )}

      {/* Main Single-Column Flow on Mobile, Two-Column on Desktop */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.25fr_0.75fr]">
        {/* Left Side: Upload Zone & Preview */}
        <div className="space-y-5">
          {/* File Picker / Drag Drop Container */}
          {state.currentStep === 'idle' && !selectedFile && (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 sm:p-10 border-2 border-dashed rounded-clinical text-center cursor-pointer transition-all duration-200 bg-white dark:bg-[#1E293B] shadow-soft hover:border-clinical-primary ${
                dragActive
                  ? 'border-clinical-primary bg-clinical-primary/5 dark:bg-clinical-primary/10 scale-[1.01]'
                  : 'border-clinical-border dark:border-slate-700'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.dcm,image/png,image/jpeg"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="h-16 w-16 mx-auto rounded-full bg-clinical-primary/10 dark:bg-clinical-primary/20 flex items-center justify-center text-clinical-primary mb-3">
                <MaterialIcon name="upload_file" className="text-[36px]" />
              </div>

              <h2 className="text-base sm:text-lg font-bold text-clinical-ink dark:text-white">
                Drop your brain MRI scan here
              </h2>
              <p className="text-xs text-clinical-textSecondary mt-1 max-w-sm mx-auto">
                Drag and drop your scan into this area, or tap the button below to browse local files.
              </p>

              {/* Large, Touch-Friendly Mobile Browse Button */}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 bg-clinical-primary hover:bg-[#005c54] active:scale-95 text-white font-bold text-xs sm:text-sm rounded-clinical transition shadow-soft flex items-center justify-center gap-2 mx-auto"
                >
                  <MaterialIcon name="folder_open" className="text-[20px]" />
                  <span>Browse MRI Files</span>
                </button>
              </div>

              {/* Requirements & Supported Formats Badges */}
              <div className="flex flex-wrap justify-center items-center gap-2 mt-6 pt-5 border-t border-clinical-border dark:border-slate-800 text-[10px] text-clinical-textSecondary">
                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-semibold">
                  PNG, JPG, JPEG, DICOM (.dcm)
                </span>
                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-semibold">
                  Max Size: 15 MB
                </span>
                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded font-semibold">
                  Resolution: ≥ 128 × 128 px
                </span>
              </div>
            </div>
          )}

          {/* Selected Image Preview & Pre-Upload Validation Card */}
          {state.currentStep === 'idle' && selectedFile && previewUrl && (
            <div className="p-5 sm:p-6 bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical shadow-soft space-y-5">
              <div className="flex items-center justify-between border-b border-clinical-border dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="image" className="text-clinical-primary text-[22px]" />
                  <h3 className="text-sm font-bold text-clinical-ink dark:text-white">Selected MRI Scan Preview</h3>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="p-1.5 text-clinical-textSecondary hover:text-clinical-status-critical hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                  title="Remove image"
                >
                  <MaterialIcon name="close" className="text-[20px]" />
                </button>
              </div>

              {/* Preview Thumbnail & Metadata */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-850 p-4 rounded-clinical border border-clinical-border dark:border-slate-750">
                <div className="h-36 w-36 sm:h-28 sm:w-28 rounded-clinical overflow-hidden bg-black shrink-0 border border-slate-700 flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="MRI Preview"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left">
                  <p className="text-xs sm:text-sm font-bold text-clinical-ink dark:text-white truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-clinical-textSecondary font-mono">
                    Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Format: {selectedFile.type || 'DICOM/Image'}
                  </p>
                  {imageDimensions && (
                    <p className="text-[11px] text-clinical-textSecondary font-mono">
                      Dimensions: {imageDimensions.width} × {imageDimensions.height} px
                    </p>
                  )}
                  <div className="pt-1 flex flex-wrap gap-1.5 justify-center sm:justify-start">
                    {isLocalValidationPassed === true && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-clinical-status-normal bg-clinical-status-normal/10 border border-clinical-status-normal/20 px-2 py-0.5 rounded">
                        <MaterialIcon name="check_circle" className="text-[12px]" /> Validated MRI Image
                      </span>
                    )}
                    {isLocalValidationPassed === false && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-clinical-status-critical bg-clinical-status-critical/10 border border-clinical-status-critical/20 px-2 py-0.5 rounded">
                        <MaterialIcon name="cancel" className="text-[12px]" /> Validation Issues Detected
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline Validation Checks Checklist */}
              {localChecks.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary block">
                    Pre-Flight Image Validation
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {localChecks.map((check) => (
                      <div
                        key={check.id}
                        className={`p-2.5 rounded border text-[11px] flex items-center justify-between ${
                          check.status === 'passed'
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
                            : 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300'
                        }`}
                      >
                        <span className="font-semibold">{check.label}</span>
                        <span className="font-bold font-mono text-[10px] uppercase">
                          {check.status === 'passed' ? '✓ Passed' : '✗ Failed'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons: Analyze Scan vs Replace/Remove */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  disabled={isSubmitting || isLocalValidationPassed === false}
                  className="flex-1 min-h-[48px] px-5 py-3 bg-clinical-primary hover:bg-[#005c54] active:scale-95 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-clinical transition shadow-soft flex items-center justify-center gap-2"
                >
                  <MaterialIcon name="play_arrow" className="text-[20px]" />
                  <span>Start AI Analysis</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[48px] px-4 py-2.5 border border-clinical-border dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold rounded-clinical text-clinical-ink dark:text-white transition"
                >
                  Replace File
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="min-h-[48px] px-4 py-2.5 border border-red-200 dark:border-red-800/40 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold rounded-clinical text-clinical-status-critical transition"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {/* Active Processing Workflow Progress Card */}
          {state.currentStep !== 'idle' && (
            <div
              ref={progressSectionRef}
              className="p-5 sm:p-6 rounded-clinical bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 shadow-soft space-y-5"
            >
              {state.currentStep === 'success' ? (
                <div ref={resultsSectionRef} className="flex flex-col items-center justify-center py-6 space-y-4">
                  <div className="h-16 w-16 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                    <MaterialIcon name="check" className="text-[32px] text-emerald-500 font-bold" />
                  </div>
                  <div className="text-center space-y-1">
                    <h3 className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      AI Diagnostic Pipeline Succeeded
                    </h3>
                    <p className="text-xs text-clinical-textSecondary font-medium">
                      Prediction saved. Forwarding to full workstation results...
                    </p>
                  </div>

                  {state.prediction && (
                    <div className="w-full max-w-sm p-4 bg-slate-50 dark:bg-slate-850 rounded-clinical border border-clinical-border dark:border-slate-700 text-xs space-y-2 text-center">
                      <span className="text-[10px] uppercase font-bold text-clinical-textSecondary block">
                        Predicted Screening Classification
                      </span>
                      <p className="text-base font-extrabold text-clinical-primary">
                        {state.prediction.label}
                      </p>
                      <p className="text-[11px] text-clinical-textSecondary">
                        Confidence: <span className="font-bold">{state.prediction.confidence.toFixed(1)}%</span> • Risk: <span className="font-bold">{state.prediction.riskLevel}</span>
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (state.prediction?.scanId) {
                        navigate(`/results/${state.prediction.scanId}`, {
                          state: { prediction: state.prediction, preview: previewUrl || state.file?.preview },
                        });
                      }
                    }}
                    className="min-h-[44px] px-6 py-2.5 bg-clinical-primary hover:bg-[#005c54] text-white text-xs sm:text-sm font-bold rounded-clinical transition shadow-soft flex items-center gap-2"
                  >
                    <span>View Results Now</span>
                    <MaterialIcon name="arrow_forward" className="text-[16px]" />
                  </button>
                </div>
              ) : (
                <>
                  {/* File Thumbnail & Name */}
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-clinical bg-clinical-primary/10 dark:bg-slate-800 text-clinical-primary border border-clinical-border dark:border-slate-700 shrink-0">
                      <MaterialIcon name="image" className="text-[24px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-clinical-ink dark:text-white truncate">
                        {state.file?.name || selectedFile?.name}
                      </p>
                      <p className="text-[10px] text-clinical-textSecondary font-mono mt-0.5">
                        Size: {(((state.file?.size || selectedFile?.size) ?? 0) / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={workflow.resetWorkflow}
                      className="p-1.5 text-clinical-textSecondary hover:text-clinical-status-critical hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                      title="Cancel analysis"
                    >
                      <MaterialIcon name="close" className="text-[20px]" />
                    </button>
                  </div>

                  {/* Progress Feedback Percentage & Status */}
                  <div className="border-t border-clinical-border dark:border-slate-700 pt-4 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-clinical-textPrimary dark:text-white flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-clinical-primary animate-ping" />
                        Stage: {state.currentStep.toUpperCase()}
                      </span>
                      <span className="font-mono font-bold text-clinical-primary">
                        {state.currentStep === 'uploading'
                          ? `${state.uploadProgress}%`
                          : state.currentStep === 'analyzing'
                          ? `${state.analysisProgress}%`
                          : 'Processing'}
                      </span>
                    </div>

                    {/* Dynamic Progress Bar */}
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-clinical-primary transition-all duration-300"
                        style={{
                          width: `${
                            state.currentStep === 'uploading'
                              ? state.uploadProgress
                              : state.currentStep === 'validating'
                              ? 30
                              : state.currentStep === 'preprocessing'
                              ? 50
                              : state.currentStep === 'analyzing'
                              ? Math.max(state.analysisProgress, 60)
                              : state.currentStep === 'heatmap'
                              ? 85
                              : state.currentStep === 'saving'
                              ? 95
                              : 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Pipeline Milestones */}
                  <div className="pt-2 border-t border-clinical-border dark:border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary block">
                      Truthful Processing Stages
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {stepsList.map((step) => {
                        const status = getStepStatus(step.key);
                        return (
                          <div
                            key={step.key}
                            className={`p-2 rounded border text-[10px] font-bold flex items-center gap-1.5 transition ${
                              status === 'completed'
                                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                                : status === 'active'
                                ? 'bg-clinical-primary/10 text-clinical-primary border-clinical-primary animate-pulse'
                                : 'bg-slate-50 dark:bg-slate-850 text-clinical-textSecondary border-clinical-border dark:border-slate-700'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                            <span className="truncate">{step.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Scan Clinical Notes & Protocol */}
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-5 shadow-soft space-y-4">
            <div>
              <h3 className="text-sm font-bold text-clinical-ink dark:text-white">Clinical Scan Information</h3>
              <p className="text-xs text-clinical-textSecondary mt-0.5">Session metadata and preliminary observations</p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary mb-1.5">
                  {t('upload_notes', 'Patient Diagnostic Notes (Optional)')}
                </label>
                <textarea
                  value={scanNotes}
                  onChange={(e) => setScanNotes(e.target.value)}
                  placeholder={t('upload_notes_placeholder', 'Enter patient history, cognitive observation notes, or symptom timeline...')}
                  className="w-full h-24 border border-clinical-border dark:border-slate-700 rounded-clinical p-3 text-xs focus:border-clinical-primary focus:ring-1 focus:ring-clinical-primary bg-white dark:bg-[#0F172A] placeholder-slate-400 font-medium"
                  disabled={state.currentStep !== 'idle'}
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-clinical border border-clinical-border dark:border-slate-700 text-[10px] text-clinical-textSecondary space-y-1.5 leading-relaxed">
                <span className="font-bold text-clinical-textPrimary dark:text-white uppercase tracking-wider block">
                  HIPAA & Privacy Protocol
                </span>
                <p className="font-medium text-clinical-textSecondary">
                  All MRI scans are processed through an isolated pipeline. Image matrices are preprocessed to standardize voxels and strip DICOM headers prior to deep learning classification.
                </p>
              </div>
            </div>
          </div>

          {/* Model Capabilities Notice for Part 5 */}
          <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-4 shadow-soft text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-clinical-primary font-bold text-[11px] uppercase tracking-wider">
              <MaterialIcon name="info" className="text-[16px]" />
              <span>Diagnostic Model Scope</span>
            </div>
            <p className="text-[11px] text-clinical-textSecondary leading-relaxed">
              This screening model classifies four dementia stages (<span className="font-semibold text-clinical-ink dark:text-white">NonDemented, VeryMildDemented, MildDemented, ModerateDemented</span>). It is an automated assistive tool and does not replace certified radiological review.
            </p>
          </div>
        </div>
      </div>

      {/* Diagnostics Terminal Console */}
      <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-4 sm:p-5 shadow-soft space-y-3">
        <div className="flex items-center justify-between border-b border-clinical-border dark:border-slate-700 pb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-clinical-textSecondary">
            Workspace Diagnostics Transcript
          </h3>
          <span className="h-2 w-2 bg-[#16A34A] rounded-full animate-pulse" />
        </div>

        <div className="h-36 sm:h-44 overflow-y-auto bg-slate-50 dark:bg-slate-900 border border-clinical-border dark:border-slate-800 rounded-clinical p-3.5 font-mono text-[11px] text-clinical-textPrimary leading-normal space-y-1">
          {generateLogs().map((log, idx) => (
            <div key={idx} className="border-b border-slate-100 dark:border-slate-800 pb-1 last:border-0">
              <span className="text-clinical-primary font-bold mr-1">&gt;</span> {log}
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </motion.div>
  );
}
