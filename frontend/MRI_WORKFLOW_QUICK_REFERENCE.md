# MRI Workflow - Quick Reference Guide

## 🚀 Quick Start

### 1. Use the Hook in Your Component
```typescript
import { useMRIWorkflow } from '../hooks/useMRIWorkflow';

function MyComponent() {
  const { state, uploadFile, validateMRI, startPreprocessing, startAnalysis, generatePrediction } = useMRIWorkflow();

  // state contains: file, uploadProgress, currentStep, qualityChecks, etc.
}
```

### 2. Workflow State Enum Values
```typescript
type WorkflowStep =
  | 'idle'           // Initial state, ready for upload
  | 'uploading'      // File being uploaded
  | 'validating'     // Running quality checks
  | 'preprocessing'  // Preprocessing pipeline running
  | 'analyzing'      // AI analysis in progress
  | 'generating'     // Creating prediction
  | 'success'        // Complete, redirecting to results
  | 'error'          // Error occurred
```

## 📋 Complete Workflow Usage Pattern

```typescript
import { useMRIWorkflow } from '../hooks/useMRIWorkflow';

export default function MyAnalysisComponent() {
  const { state, uploadFile, validateMRI, startPreprocessing, startAnalysis, generatePrediction, storePrediction } = useMRIWorkflow();

  // Step 1: Handle file upload
  const handleUpload = async (file: File) => {
    const preview = URL.createObjectURL(file);
    await uploadFile(file, preview);
  };

  // Step 2: Validate quality
  const handleValidate = async () => {
    await validateMRI();
    // state.qualityChecks now contains results
  };

  // Step 3: Preprocess and analyze
  const handlePreprocess = async () => {
    await startPreprocessing();
    await startAnalysis();
  };

  // Step 4: Generate prediction
  const handleGeneratePrediction = async () => {
    const prediction = await generatePrediction();
    const resultId = await storePrediction(prediction);
    // resultId can be used to navigate to results page
  };

  // Render based on workflow state
  return (
    <>
      {state.error && <ErrorAlert>{state.error}</ErrorAlert>}

      {state.currentStep === 'idle' && <UploadInterface onUpload={handleUpload} />}
      {state.currentStep === 'validating' && <ValidationResult checks={state.qualityChecks} />}
      {state.currentStep === 'preprocessing' && <PreprocessingScreen steps={state.preprocessingSteps} />}
      {state.currentStep === 'analyzing' && <AnalysisProgress metrics={state.analysisMetrics} />}
      {state.currentStep === 'success' && <SuccessScreen prediction={state.prediction} />}
    </>
  );
}
```

## 🎯 Common Tasks

### Task: Display Upload Progress
```typescript
const { state } = useMRIWorkflow();

return (
  <div>
    <progress value={state.uploadProgress} max={100} />
    <p>{state.uploadProgress}%</p>
  </div>
);
```

### Task: Check if Validation Passed
```typescript
const { state } = useMRIWorkflow();

if (state.isValidated) {
  return <button onClick={handlePreprocess}>Continue</button>;
}
```

### Task: Display Quality Check Results
```typescript
const { state } = useMRIWorkflow();

return (
  <ul>
    {state.qualityChecks.map(check => (
      <li key={check.id}>
        {check.label}: {check.status}
        {check.message && <p>{check.message}</p>}
      </li>
    ))}
  </ul>
);
```

### Task: Monitor Analysis Progress
```typescript
const { state } = useMRIWorkflow();

return (
  <div>
    <progress value={state.analysisProgress} max={100} />
    {state.analysisMetrics.map(metric => (
      <div key={metric.name}>
        <span>{metric.name}: {metric.value} {metric.unit}</span>
        <span className={`status-${metric.status}`}>{metric.status}</span>
      </div>
    ))}
  </div>
);
```

### Task: Handle Errors Gracefully
```typescript
const { state, clearError } = useMRIWorkflow();

return (
  <>
    {state.error && (
      <div className="error-alert">
        <p>{state.error}</p>
        {state.errorDetails && <p className="details">{state.errorDetails}</p>}
        <button onClick={clearError}>Dismiss</button>
      </div>
    )}
  </>
);
```

### Task: Auto-advance Workflow
```typescript
const { state, startPreprocessing, startAnalysis } = useMRIWorkflow();

useEffect(() => {
  // Auto-advance after validation passes
  if (state.isValidated && state.currentStep === 'validating') {
    startPreprocessing();
  }
}, [state.isValidated, state.currentStep]);

useEffect(() => {
  // Auto-start analysis after preprocessing completes
  if (state.currentStep === 'preprocessing' && state.stepProgress === 100) {
    startAnalysis();
  }
}, [state.currentStep, state.stepProgress]);
```

## 📊 State Structure Reference

```typescript
interface MRIAnalysisState {
  // File upload
  file: {
    name: string;
    size: number;
    type: string;
    preview: string;  // Data URL
  } | null;
  uploadProgress: number;  // 0-100

  // Workflow tracking
  currentStep: WorkflowStep;
  stepProgress: number;  // 0-100

  // Validation
  qualityChecks: Array<{
    id: string;
    label: string;
    status: 'passed' | 'warning' | 'failed';
    message: string;
    severity: 'info' | 'warning' | 'error';
  }>;
  isValidated: boolean;
  validationError: string | null;

  // Preprocessing
  preprocessingSteps: Array<{
    id: string;
    name: string;
    description: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;  // 0-100
    duration?: number;  // seconds
  }>;

  // Analysis
  analysisMetrics: Array<{
    name: string;
    value: number;
    unit: string;
    status: 'normal' | 'warning' | 'critical';
  }>;
  analysisProgress: number;  // 0-100

  // Results
  prediction: {
    label: 'Non Demented' | 'Very Mild Demented' | 'Mild Demented' | 'Moderate Demented';
    confidence: number;  // 65-95
    riskScore: number;   // 0-100
    riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
    timestamp: string;   // ISO format
    scanId: string;
  } | null;

  // Error handling
  error: string | null;
  errorDetails: string | null;
}
```

## 🔧 Extending the Workflow

### Add a Custom Quality Check
1. Edit `mri-analysis.ts` function `validateMRIQuality()`
2. Add new check to the `checks` array:
```typescript
{
  id: 'my-check',
  label: 'My Custom Check',
  status: 'passed' as ValidationStatus,
  message: 'Check description',
  severity: 'info'
}
```

### Add a Preprocessing Step
1. Edit `mri-analysis.ts` function `simulatePreprocessing()`
2. Add to the `steps` array:
```typescript
{
  id: '6',
  name: 'My Step',
  description: 'What it does',
  status: 'pending',
  progress: 0
}
```

### Add a New Analysis Metric
1. Edit `mri-analysis.ts` function `simulateAnalysis()`
2. Add to the `baseMetrics` array:
```typescript
{
  name: 'My Metric',
  value: 0,
  unit: 'unit',
  status: 'normal'
}
```

### Connect to Real Backend
1. Update functions in `mri-analysis.ts`:
```typescript
// OLD: Simulated
export async function uploadMRIFile(file: File, onProgressUpdate: (p: number) => void): Promise<string> {
  await sleep(5000);
  return 'file_id_123';
}

// NEW: Real API
export async function uploadMRIFile(file: File, onProgressUpdate: (p: number) => void): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const xhr = new XMLHttpRequest();
  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const progress = Math.round((e.loaded / e.total) * 100);
      onProgressUpdate(progress);
    }
  });

  return new Promise((resolve, reject) => {
    xhr.addEventListener('load', () => {
      const result = JSON.parse(xhr.responseText);
      resolve(result.fileId);
    });
    xhr.addEventListener('error', reject);
    xhr.open('POST', '/api/mri/upload');
    xhr.send(formData);
  });
}
```

## 🎨 Component Props Reference

### PreprocessingScreen
```typescript
interface PreprocessingScreenProps {
  steps: PreprocessingStep[];
  progress: number;  // 0-100
}
```

### AnalysisProgress
```typescript
interface AnalysisProgressProps {
  progress: number;  // 0-100
  metrics: AnalysisMetric[];
}
```

### ValidationResult
```typescript
interface ValidationResultProps {
  checks: QualityCheckResult[];
  isValidated: boolean;
  validationError: string | null;
  onContinue?: () => void;
  isLoading?: boolean;
}
```

## 📝 Type Definitions

All TypeScript types are defined in `src/types/mri-workflow.ts`:
- `WorkflowStep` - Workflow state enum
- `MRIAnalysisState` - Complete state shape
- `QualityCheckResult` - Quality check details
- `PreprocessingStep` - Preprocessing step details
- `AnalysisMetric` - Biomarker details
- `PredictionResult` - Final prediction shape
- `MRIWorkflowContextType` - Context API type

## 🚨 Error Codes & Handling

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid file type | Unsupported format | Use JPG, PNG, or DICOM |
| File too large | Exceeds 50MB | Compress or split file |
| Validation failed | Quality checks | Try different image |
| Upload failed | Network error | Check connection, retry |
| Preprocessing failed | Step computation error | Reset and retry |
| Analysis failed | Model error | Contact support |

## 🧪 Testing Checklist

- [ ] Drag and drop upload works
- [ ] File selection dialog works
- [ ] Upload progress updates
- [ ] Quality checks run and display
- [ ] Preprocessing steps show progress
- [ ] Analysis metrics update in real-time
- [ ] Prediction generates successfully
- [ ] Redirect to results page works
- [ ] Error alerts display and dismiss
- [ ] Reset workflow clears state
- [ ] Dark mode styling works
- [ ] Mobile responsive design works

## 📞 Support

For issues or questions:
1. Check this quick reference
2. Review `MRI_WORKFLOW_IMPLEMENTATION.md`
3. Check component TypeScript interfaces
4. Review `mri-analysis.ts` for API signatures
5. Check browser console for errors
6. Enable Redux DevTools for state inspection
