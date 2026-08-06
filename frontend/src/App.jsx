import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import OnboardingPage from './pages/OnboardingPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import DashboardPage from './pages/DashboardPage';
import BatchesPage from './pages/BatchesPage';
import StudiesPage from './pages/StudiesPage';
import UsersPage from './pages/UsersPage';
import SecurityPage from './pages/SecurityPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.needs_studies) return <Navigate to="/onboarding" replace />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/" replace /> : <SignUpPage />} />
      <Route
        path="/onboarding"
        element={(() => {
          if (!isAuthenticated) return <Navigate to="/login" replace />;
          if (!user?.needs_studies) return <Navigate to="/" replace />;
          return <OnboardingPage />;
        })()}
      />
      <Route path="/login/oauth" element={<OAuthCallbackPage />} />
      <Route
        path="/"
        element={(
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        )}
      >
        <Route index element={<DashboardPage />} />
        <Route path="batches" element={<BatchesPage />} />
        <Route path="studies" element={<StudiesPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="security" element={<SecurityPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
