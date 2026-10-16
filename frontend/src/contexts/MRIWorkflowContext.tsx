import { createContext, useCallback, useReducer, ReactNode, useRef, Dispatch } from 'react';
import {
  MRIAnalysisState,
  MRIWorkflowContextType,
  WorkflowStep,
  PreprocessingStep,
  AnalysisMetric,
  PredictionResult,
  QualityCheckResult,
} from '../types/mri-workflow';
import { uploadMRIScan, extractValidationFromError, predictMRIScan, generateHeatmap } from '../services/mriService';
import { notifyAnalysisCompleted } from '../events/dashboardEvents';
import { validateMRIFile } from '../utils/mriValidation';
import { useNotifications } from './NotificationContext';

const WORKFLOW_STEP_PAUSE_MS = 450;

function waitForWorkflowStep() {
  return new Promise((resolve) => window.setTimeout(resolve, WORKFLOW_STEP_PAUSE_MS));
}

const initialState: MRIAnalysisState = {
  file: null,
  uploadProgress: 0,
  scanId: null,
  currentStep: 'idle',
  stepProgress: 0,
  qualityChecks: [],
  isValidated: false,
  validationError: null,
  preprocessingSteps: [],
  analysisMetrics: [],
  analysisProgress: 0,
  prediction: null,
  error: null,
  errorDetails: null,
};

type Action =
  | { type: 'SET_FILE'; payload: { name: string; size: number; type: string; preview: string; scanId: string | null } }
  | { type: 'SET_UPLOAD_PROGRESS'; payload: number }
  | { type: 'SET_CURRENT_STEP'; payload: WorkflowStep }
  | { type: 'SET_STEP_PROGRESS'; payload: number }
  | { type: 'SET_QUALITY_CHECKS'; payload: QualityCheckResult[] }
  | { type: 'SET_VALIDATED'; payload: boolean }
  | { type: 'SET_VALIDATION_ERROR'; payload: string | null }
  | { type: 'SET_PREPROCESSING_STEPS'; payload: PreprocessingStep[] }
  | { type: 'SET_ANALYSIS_METRICS'; payload: AnalysisMetric[] }
  | { type: 'SET_ANALYSIS_PROGRESS'; payload: number }
  | { type: 'SET_PREDICTION'; payload: PredictionResult | null }
  | { type: 'SET_ERROR'; payload: { error: string; details?: string } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

function mriAnalysisReducer(state: MRIAnalysisState, action: Action): MRIAnalysisState {
  switch (action.type) {
    case 'SET_FILE':
      return {
        ...state,
        file: action.payload,
        scanId: action.payload.scanId,
        error: null,
        validationError: null,
      };
    case 'SET_UPLOAD_PROGRESS':
      return { ...state, uploadProgress: action.payload };
    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.payload, stepProgress: 0 };
    case 'SET_STEP_PROGRESS':
      return { ...state, stepProgress: action.payload };
    case 'SET_QUALITY_CHECKS':
      return { ...state, qualityChecks: action.payload };
    case 'SET_VALIDATED':
      return { ...state, isValidated: action.payload };
    case 'SET_VALIDATION_ERROR':
      return { ...state, validationError: action.payload };
    case 'SET_PREPROCESSING_STEPS':
      return { ...state, preprocessingSteps: action.payload };
    case 'SET_ANALYSIS_METRICS':
      return { ...state, analysisMetrics: action.payload };
    case 'SET_ANALYSIS_PROGRESS':
      return { ...state, analysisProgress: action.payload };
    case 'SET_PREDICTION':
      return { ...state, prediction: action.payload };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload.error,
        errorDetails: action.payload.details || null,
      };
    case 'CLEAR_ERROR':
      return { ...state, error: null, errorDetails: null };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export const MRIWorkflowContext = createContext<MRIWorkflowContextType | undefined>(undefined);

function buildTimingMetrics(timingMs?: Record<string, number>): AnalysisMetric[] {
  if (!timingMs) {
    return [];
  }

  const metricNames: Array<[string, string]> = [
    ['Model load', 'model_load_ms'],
    ['Preprocessing', 'preprocess_ms'],
    ['TensorFlow inference', 'inference_ms'],
    ['Report generation', 'report_generation_ms'],
    ['Database save', 'database_save_ms'],
    ['Total prediction', 'total_ms'],
  ];

  return metricNames
    .filter(([, key]) => typeof timingMs[key] === 'number')
    .map(([name, key]) => {
      const value = Math.round(timingMs[key]);
      return {
        name,
        value,
        unit: 'ms',
        status: value > 15000 ? 'warning' : 'normal',
      };
    });
}

async function runPreprocessingStep(dispatch: Dispatch<Action>) {
  dispatch({ type: 'SET_CURRENT_STEP', payload: 'preprocessing' });
  dispatch({
    type: 'SET_PREPROCESSING_STEPS',
    payload: [
      {
        id: 'server-validation',
        name: 'Server validation',
        description: 'Backend validation completed for this upload.',
        status: 'completed',
        progress: 100,
      },
      {
        id: 'image-preprocessing',
        name: 'Image preprocessing',
        description: 'MRI image prepared for AI inference.',
        status: 'completed',
        progress: 100,
      },
    ],
  });
  dispatch({ type: 'SET_STEP_PROGRESS', payload: 100 });
  await waitForWorkflowStep();
}

async function runAnalysisStep(dispatch: Dispatch<Action>) {
  dispatch({ type: 'SET_CURRENT_STEP', payload: 'analyzing' });
  dispatch({ type: 'SET_ANALYSIS_METRICS', payload: [] });
  dispatch({ type: 'SET_ANALYSIS_PROGRESS', payload: 100 });
  dispatch({ type: 'SET_STEP_PROGRESS', payload: 100 });
  await waitForWorkflowStep();
}

export function MRIWorkflowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(mriAnalysisReducer, initialState);
  const { addNotification } = useNotifications();
  const sourceFileRef = useRef<File | null>(null);

  const uploadFile = useCallback(
    async (file: File, preview: string) => {
      let activeStage: 'upload' | 'analysis' = 'upload';
      try {
        sourceFileRef.current = file;
        dispatch({ type: 'CLEAR_ERROR' });
        dispatch({
          type: 'SET_FILE',
          payload: {
            name: file.name,
            size: file.size,
            type: file.type,
            preview,
            scanId: null,
          },
        });
        dispatch({ type: 'SET_CURRENT_STEP', payload: 'uploading' });
        dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 0 });

        const localValidation = await validateMRIFile(file);
        dispatch({ type: 'SET_QUALITY_CHECKS', payload: localValidation.checks });
        dispatch({ type: 'SET_VALIDATED', payload: localValidation.passed });

        if (!localValidation.passed) {
          dispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Image validation failed. See details below.' });
          dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 0 });
          dispatch({ type: 'SET_CURRENT_STEP', payload: 'validating' });
          dispatch({ type: 'SET_STEP_PROGRESS', payload: 100 });
          return;
        }

        dispatch({ type: 'SET_CURRENT_STEP', payload: 'uploading' });
        dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 0 });

        // Upload to backend — validates type, size, resolution, corruption.
        // Backend uploads to Supabase Storage and stores metadata in scans table.
        const response = await uploadMRIScan(file, (progress) => {
          dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: progress });
        });

        // Store file metadata and scan_id from backend response
        dispatch({
          type: 'SET_FILE',
          payload: {
            name: file.name,
            size: file.size,
            type: file.type,
            preview,
            scanId: response.scanId,
          },
        });
        dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 100 });

        // Surface validation checks from the upload response
        if (response.validation?.checks?.length > 0) {
          dispatch({ type: 'SET_QUALITY_CHECKS', payload: response.validation.checks });
          dispatch({ type: 'SET_VALIDATED', payload: response.validation.passed });
        } else {
          dispatch({ type: 'SET_VALIDATED', payload: true });
        }

        dispatch({ type: 'SET_CURRENT_STEP', payload: 'validating' });
        dispatch({ type: 'SET_STEP_PROGRESS', payload: 100 });
        await waitForWorkflowStep();

        activeStage = 'analysis';
        await runPreprocessingStep(dispatch);

        dispatch({ type: 'SET_CURRENT_STEP', payload: 'analyzing' });
        dispatch({ type: 'SET_STEP_PROGRESS', payload: 15 });
        dispatch({ type: 'SET_ANALYSIS_PROGRESS', payload: 15 });
        dispatch({ type: 'SET_ANALYSIS_METRICS', payload: [] });

        let simulatedProgress = 15;
        let progressTimer: number | undefined = window.setInterval(() => {
          simulatedProgress = Math.min(simulatedProgress + 8, 90);
          dispatch({ type: 'SET_STEP_PROGRESS', payload: simulatedProgress });
          dispatch({ type: 'SET_ANALYSIS_PROGRESS', payload: simulatedProgress });
        }, 1200);

        try {
          const prediction = await predictMRIScan(response.scanId);
          if (progressTimer) {
            window.clearInterval(progressTimer);
            progressTimer = undefined;
          }
          dispatch({ type: 'SET_STEP_PROGRESS', payload: 100 });
          dispatch({ type: 'SET_ANALYSIS_PROGRESS', payload: 100 });

          dispatch({ type: 'SET_CURRENT_STEP', payload: 'heatmap' });
          dispatch({ type: 'SET_STEP_PROGRESS', payload: 20 });
          dispatch({ type: 'SET_ANALYSIS_PROGRESS', payload: 20 });

          const heatmap = await generateHeatmap(response.scanId);
          const predictionWithHeatmap = {
            ...prediction,
            originalImageUrl: prediction.originalImageUrl ?? response.original_image_url,
            heatmapUrl: heatmap.heatmapUrl,
          };
          dispatch({ type: 'SET_STEP_PROGRESS', payload: 100 });
          dispatch({ type: 'SET_ANALYSIS_PROGRESS', payload: 100 });

          dispatch({ type: 'SET_CURRENT_STEP', payload: 'saving' });
          dispatch({ type: 'SET_STEP_PROGRESS', payload: 65 });
          dispatch({ type: 'SET_ANALYSIS_METRICS', payload: buildTimingMetrics(prediction.timingMs) });
          dispatch({ type: 'SET_PREDICTION', payload: predictionWithHeatmap });
          dispatch({ type: 'SET_STEP_PROGRESS', payload: 100 });
          dispatch({ type: 'SET_ANALYSIS_PROGRESS', payload: 100 });
          await waitForWorkflowStep();
          dispatch({ type: 'SET_CURRENT_STEP', payload: 'success' });
          notifyAnalysisCompleted({
            scanId: predictionWithHeatmap.scanId,
            reportId: predictionWithHeatmap.reportId,
            prediction: predictionWithHeatmap.label,
          });
          addNotification(
            'success',
            'Scan Completed',
            `MRI Scan #${predictionWithHeatmap.scanId.slice(0, 8)} processed successfully.`
          );
          addNotification(
            'success',
            'Report Generated',
            `Diagnostic report sheet compiled for ${predictionWithHeatmap.patientName || 'Patient'}.`
          );
        } finally {
          if (progressTimer) {
            window.clearInterval(progressTimer);
            progressTimer = undefined;
          }
        }
      } catch (error) {
        // Attempt to extract validation checks from a 422 error
        const checks = extractValidationFromError(error);
        if (checks) {
          dispatch({ type: 'SET_QUALITY_CHECKS', payload: checks });
          dispatch({ type: 'SET_VALIDATED', payload: false });
          dispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Image validation failed. See details below.' });
          dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 100 });
          dispatch({ type: 'SET_CURRENT_STEP', payload: 'validating' });
          dispatch({ type: 'SET_STEP_PROGRESS', payload: 100 });
          return;
        }

        dispatch({
          type: 'SET_ERROR',
          payload: {
            error: activeStage === 'analysis' ? 'Analysis workflow failed' : 'Upload failed',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    },
    []
  );

  const validateMRI = useCallback(async () => {
    // Surface already-known checks from the upload response
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'validating' });
    dispatch({ type: 'SET_VALIDATION_ERROR', payload: null });

    const failedChecks = state.qualityChecks.filter((c) => c.status === 'failed');
    if (failedChecks.length > 0) {
      dispatch({
        type: 'SET_VALIDATION_ERROR',
        payload: `Validation failed: ${failedChecks.length} check(s) did not pass`,
      });
      dispatch({ type: 'SET_VALIDATED', payload: false });
    } else {
      dispatch({ type: 'SET_VALIDATED', payload: true });
    }
    dispatch({ type: 'SET_STEP_PROGRESS', payload: 100 });
  }, [state.qualityChecks]);

  const startPreprocessing = useCallback(async () => {
    try {
      await runPreprocessingStep(dispatch);
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: {
          error: 'Preprocessing failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }, []);

  const startAnalysis = useCallback(async () => {
    try {
      await runAnalysisStep(dispatch);
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: {
          error: 'Analysis failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }, []);

  const generatePredictionPredicate = useCallback(async () => {
    let progressTimer: number | undefined;
    try {
      dispatch({ type: 'SET_CURRENT_STEP', payload: 'generating' });
      dispatch({ type: 'SET_STEP_PROGRESS', payload: 15 });
      dispatch({ type: 'SET_ANALYSIS_PROGRESS', payload: 15 });
      dispatch({ type: 'SET_ANALYSIS_METRICS', payload: [] });

      if (!state.scanId) {
        throw new Error('No uploaded MRI scan is available for analysis');
      }

      let simulatedProgress = 15;
      progressTimer = window.setInterval(() => {
        simulatedProgress = Math.min(simulatedProgress + 8, 90);
        dispatch({ type: 'SET_STEP_PROGRESS', payload: simulatedProgress });
        dispatch({ type: 'SET_ANALYSIS_PROGRESS', payload: simulatedProgress });
      }, 1200);

      const prediction = await predictMRIScan(state.scanId);
      if (progressTimer) {
        window.clearInterval(progressTimer);
        progressTimer = undefined;
      }
      dispatch({ type: 'SET_STEP_PROGRESS', payload: 95 });
      dispatch({ type: 'SET_ANALYSIS_PROGRESS', payload: 95 });
      dispatch({ type: 'SET_ANALYSIS_METRICS', payload: buildTimingMetrics(prediction.timingMs) });

      dispatch({ type: 'SET_PREDICTION', payload: prediction });
      dispatch({ type: 'SET_STEP_PROGRESS', payload: 100 });
      dispatch({ type: 'SET_ANALYSIS_PROGRESS', payload: 100 });
      notifyAnalysisCompleted({
        scanId: prediction.scanId,
        reportId: prediction.reportId,
        prediction: prediction.label,
      });

      return prediction;
    } catch (error) {
      if (progressTimer) {
        window.clearInterval(progressTimer);
      }
      dispatch({
        type: 'SET_ERROR',
        payload: {
          error: 'Prediction generation failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }, [state.scanId]);

  const storePredictionPredicate = useCallback(
    async (prediction: PredictionResult) => {
      try {
        dispatch({ type: 'SET_CURRENT_STEP', payload: 'success' });
      dispatch({ type: 'SET_STEP_PROGRESS', payload: 100 });

      return prediction.scanId;
      } catch (error) {
        dispatch({
          type: 'SET_ERROR',
          payload: {
            error: 'Failed to store results',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        throw error;
      }
    },
    []
  );

  const resetWorkflow = useCallback(() => {
    sourceFileRef.current = null;
    dispatch({ type: 'RESET' });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const value: MRIWorkflowContextType = {
    state,
    uploadFile,
    validateMRI,
    startPreprocessing,
    startAnalysis,
    generatePrediction: generatePredictionPredicate,
    storePrediction: storePredictionPredicate,
    resetWorkflow,
    clearError,
  };

  return (
    <MRIWorkflowContext.Provider value={value}>{children}</MRIWorkflowContext.Provider>
  );
}
