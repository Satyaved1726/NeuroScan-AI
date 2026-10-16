import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { MRIWorkflowProvider } from './contexts/MRIWorkflowContext';
import { ProfilePhotoProvider } from './contexts/ProfilePhotoContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ErrorBoundary from './components/ErrorBoundary';
import App from './App';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false, // Avoid excessive refetches on window focus
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <DarkModeProvider>
            <NotificationProvider>
              <LayoutProvider>
                <AuthProvider>
                  <ToastProvider>
                    <ProfilePhotoProvider>
                      <MRIWorkflowProvider>
                        <App />
                      </MRIWorkflowProvider>
                    </ProfilePhotoProvider>
                  </ToastProvider>
                </AuthProvider>
              </LayoutProvider>
            </NotificationProvider>
          </DarkModeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
