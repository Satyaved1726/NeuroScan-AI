import React, { Suspense, lazy } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useToastContext } from './hooks/useToastContext';
import Shell from './components/Shell';
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastContainer } from './components/Toast';
import LoadingScreen from './components/LoadingScreen';

import { LanguageProvider } from './contexts/LanguageContext';

// Lazy load pages
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PatientProfilePage = lazy(() => import('./pages/PatientProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  const { isLoading } = useAuth();
  const { toasts, removeToast } = useToastContext();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <LanguageProvider>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Public Routes */}
          <Route element={<Shell />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Protected Routes - With MainLayout */}
          <Route
            element={
              <ProtectedRoute
                element={<MainLayout><DashboardPage /></MainLayout>}
                requiresAdmin={false}
              />
            }
            path="/dashboard"
          />
          <Route
            element={
              <ProtectedRoute
                element={<MainLayout><UploadPage /></MainLayout>}
                requiresAdmin={false}
              />
            }
            path="/analysis"
          />
          <Route
            element={
              <ProtectedRoute
                element={<MainLayout><ResultsPage /></MainLayout>}
                requiresAdmin={false}
              />
            }
            path="/results"
          />
          <Route
            element={
              <ProtectedRoute
                element={<MainLayout><ResultsPage /></MainLayout>}
                requiresAdmin={false}
              />
            }
            path="/results/:scanId"
          />
          <Route
            element={
              <ProtectedRoute
                element={<MainLayout><ResultsPage /></MainLayout>}
                requiresAdmin={false}
              />
            }
            path="/results/*"
          />

          {/* Protected Routes - AI Assistant */}
          <Route
            path="/assistant"
            element={<Navigate to="/dashboard?openChat=true" replace />}
          />

          {/* Protected Routes - Reports & History */}
          <Route
            element={
              <ProtectedRoute
                element={<MainLayout><HistoryPage /></MainLayout>}
                requiresAdmin={false}
              />
            }
            path="/reports"
          />
          <Route
            path="/history"
            element={<Navigate to="/reports" replace />}
          />

          {/* Protected Routes - User Settings & Patient Records */}
          <Route
            element={
              <ProtectedRoute
                element={<MainLayout><ProfilePage /></MainLayout>}
                requiresAdmin={false}
              />
            }
            path="/profile"
          />
          <Route
            element={
              <ProtectedRoute
                element={<MainLayout><PatientProfilePage /></MainLayout>}
                requiresAdmin={false}
              />
            }
            path="/patients/:id"
          />
          <Route
            element={
              <ProtectedRoute
                element={<MainLayout><SettingsPage /></MainLayout>}
                requiresAdmin={false}
              />
            }
            path="/settings"
          />

          {/* Admin Routes */}
          <Route
            element={
              <ProtectedRoute
                element={<MainLayout><AdminPage /></MainLayout>}
                requiresAdmin={true}
              />
            }
            path="/admin"
          />

          {/* 404 - Catch all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </LanguageProvider>
  );
}
