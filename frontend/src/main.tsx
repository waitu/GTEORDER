import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { LandingPage } from './pages/Landing';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { OtpPage } from './pages/Otp';
import { NotFoundPage } from './pages/NotFound';
import { UnauthorizedPage } from './pages/Unauthorized';
import { DashboardPage } from './pages/app/Dashboard';
import { OrdersPage, DesignOrdersPage } from './pages/app/Orders';
import { BalancePage } from './pages/app/Balance';
import { PricingPage } from './pages/app/Pricing';
import { PricingDetailsPage } from './pages/app/PricingDetails';
import { AnalyticsPage } from './pages/app/Analytics';
import { DevicesPage } from './pages/app/Devices';
import { AccountPage } from './pages/app/Account';
import { MeDevicesPage } from './pages/me/Devices';
import { AdminRequestsPage } from './pages/admin/Requests';
import { AdminAuditsPage } from './pages/admin/Audits';
import { AdminDashboardPage } from './pages/admin/Dashboard';
import { AdminUsersPage } from './pages/admin/Users';
import { PricingManagementPage } from './pages/admin/PricingManagement';
import { BalanceAdjustmentsPage } from './pages/admin/BalanceAdjustments';
import { AdminCreditTopupsPage } from './pages/admin/CreditTopups';
import { SystemLogsPage } from './pages/admin/SystemLogs';
import { AdminOrdersPage } from './pages/admin/Orders';
import { AuthProvider } from './context/AuthProvider';
import { ProtectedRoute, AdminRoute, GuestRoute, OtpRoute } from './components/ProtectedRoute';

const queryClient = new QueryClient();

const AuthShell = () => (
  <AuthProvider>
    <Outlet />
  </AuthProvider>
);

const router = createBrowserRouter([
  {
    element: <AuthShell />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/login', element: <GuestRoute><LoginPage /></GuestRoute> },
      { path: '/register', element: <GuestRoute><RegisterPage /></GuestRoute> },
      { path: '/otp', element: <OtpRoute><OtpPage /></OtpRoute> },
      { path: '/dashboard', element: <ProtectedRoute><DashboardPage /></ProtectedRoute> },
      { path: '/orders', element: <ProtectedRoute><OrdersPage /></ProtectedRoute> },
      { path: '/design', element: <ProtectedRoute><DesignOrdersPage /></ProtectedRoute> },
      { path: '/trackings', element: <ProtectedRoute><OrdersPage /></ProtectedRoute> },
      { path: '/empty-orders', element: <ProtectedRoute><OrdersPage /></ProtectedRoute> },
      { path: '/balance', element: <ProtectedRoute><BalancePage /></ProtectedRoute> },
      { path: '/pricing', element: <ProtectedRoute><PricingPage /></ProtectedRoute> },
      { path: '/pricing/details', element: <ProtectedRoute><PricingDetailsPage /></ProtectedRoute> },
      { path: '/analytics', element: <ProtectedRoute><AnalyticsPage /></ProtectedRoute> },
      { path: '/account', element: <ProtectedRoute><AccountPage /></ProtectedRoute> },
      { path: '/devices', element: <ProtectedRoute><DevicesPage /></ProtectedRoute> },
      { path: '/me/devices', element: <ProtectedRoute><MeDevicesPage /></ProtectedRoute> },
      { path: '/admin', element: <AdminRoute><AdminDashboardPage /></AdminRoute> },
      { path: '/admin/orders', element: <AdminRoute><AdminOrdersPage /></AdminRoute> },
      { path: '/admin/users', element: <AdminRoute><AdminUsersPage /></AdminRoute> },
      { path: '/admin/requests', element: <AdminRoute><AdminRequestsPage /></AdminRoute> },
      { path: '/admin/audits', element: <AdminRoute><AdminAuditsPage /></AdminRoute> },
      { path: '/admin/pricing', element: <AdminRoute><PricingManagementPage /></AdminRoute> },
      { path: '/admin/balance-adjustments', element: <AdminRoute><BalanceAdjustmentsPage /></AdminRoute> },
      { path: '/admin/credit-topups', element: <AdminRoute><AdminCreditTopupsPage /></AdminRoute> },
      { path: '/admin/system-logs', element: <AdminRoute><SystemLogsPage /></AdminRoute> },
      { path: '/unauthorized', element: <UnauthorizedPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

// Reuse the same root across hot reloads to avoid duplicate roots fighting over the DOM
// which can trigger "removeChild" errors in dev.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const existingRoot = (container as any)._reactRoot as ReactDOM.Root | undefined;
const root = existingRoot ?? ReactDOM.createRoot(container);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(container as any)._reactRoot = root;

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    root.unmount();
  });
}
