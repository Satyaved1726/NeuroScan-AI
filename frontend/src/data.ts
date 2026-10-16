/**
 * Shared static product copy.
 *
 * This application now uses real services to fetch data from the backend API:
 *
 * - Dashboard data: See src/services/dashboardService.ts
 * - Admin metrics: See src/services/adminService.ts
 * - Scan history: See src/services/historyService.ts
 * - Reports: See src/services/reportService.ts
 * - User profile: See src/contexts/AuthContext.tsx
 * - MRI analysis: See src/services/mriService.ts
 */

export const landingFeatures = [
  {
    title: 'MRI Analysis',
    description: 'Secure image upload with medical-grade validation and quality checks.',
  },
  {
    title: 'Explainable AI',
    description: 'Heatmaps and region insights for transparent clinical review.',
  },
  {
    title: 'Clinical Reports',
    description: 'Professional summaries ready for hospital workflow integration.',
  },
  {
    title: 'Risk Assessment',
    description: 'Clear low-to-critical scoring with visual guidance.',
  },
  {
    title: 'AI Assistant',
    description: 'Safe clinical guidance in plain language for patients and staff.',
  },
  {
    title: 'Prediction Analytics',
    description: 'Trends, benchmarks, and quality metrics across scans.',
  },
];
