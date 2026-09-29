import { Navigate, Route, Routes } from 'react-router-dom';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

import UserDashboardPage from './pages/user/UserDashboardPage';
import JoinQueuePage from './pages/user/JoinQueuePage';
import QueueStatusPage from './pages/user/QueueStatusPage';
import HistoryPage from './pages/user/HistoryPage';

import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import ServiceManagementPage from './pages/admin/ServiceManagementPage';
import QueueManagementPage from './pages/admin/QueueManagementPage';

function App() {
  return (
    <Routes>
      {/* Authentication */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* User */}
      <Route path="/dashboard" element={<UserDashboardPage />} />
      <Route path="/join-queue" element={<JoinQueuePage />} />
      <Route path="/queue-status" element={<QueueStatusPage />} />
      <Route path="/history" element={<HistoryPage />} />

      {/* Admin */}
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route
        path="/admin/services"
        element={<ServiceManagementPage />}
      />
      <Route
        path="/admin/queue"
        element={<QueueManagementPage />}
      />

      {/* Default route */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Invalid URL */}
      <Route path="*" element={<h1>Page Not Found</h1>} />
    </Routes>
  );
}

export default App;