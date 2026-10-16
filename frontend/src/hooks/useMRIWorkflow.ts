import { useContext } from 'react';
import { MRIWorkflowContext } from '../contexts/MRIWorkflowContext';

export function useMRIWorkflow() {
  const context = useContext(MRIWorkflowContext);
  if (context === undefined) {
    throw new Error('useMRIWorkflow must be used within MRIWorkflowProvider');
  }
  return context;
}
