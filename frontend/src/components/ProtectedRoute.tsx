import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingScreen from './LoadingScreen';

interface ProtectedRouteProps {
  element: JSX.Element;
  requiresAdmin?: boolean;
}

export default function ProtectedRoute({ element, requiresAdmin = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiresAdmin && user?.role !== 'Admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return element;
}
