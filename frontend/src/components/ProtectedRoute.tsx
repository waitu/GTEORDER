import { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';

type GuardProps = {
  children: ReactElement;
};

const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">Loading session…</div>
);

export const ProtectedRoute = ({ children }: GuardProps) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

export const AdminRoute = ({ children }: GuardProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/unauthorized" replace />;
  return children;
};

export const GuestRoute = ({ children }: GuardProps) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
};

export const OtpRoute = ({ children }: GuardProps) => {
  const { isAuthenticated, isLoading, pendingOtpRequestId } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  if (!pendingOtpRequestId) return <Navigate to="/login" replace />;
  return children;
};
