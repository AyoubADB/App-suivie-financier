import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { PeriodProvider } from './context/PeriodContext';
import { ScopeProvider } from './context/ScopeContext';
import { ThemeProvider } from './context/ThemeContext';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Movements } from './pages/Movements';
import { Settings } from './pages/Settings';

function Shell() {
  const { loading, needsLogin } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    );
  }

  if (needsLogin) return <Login />;

  return (
    <DataProvider>
      <ScopeProvider>
        <PeriodProvider>
          <BrowserRouter>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/mouvements" element={<Movements />} />
                <Route path="/reglages" element={<Settings />} />
                {/* Anciennes routes — redirigées vers l'écran unifié */}
                <Route path="/perso" element={<Navigate to="/mouvements" replace />} />
                <Route path="/pro" element={<Navigate to="/mouvements" replace />} />
                <Route path="/abonnements" element={<Navigate to="/mouvements" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </PeriodProvider>
      </ScopeProvider>
    </DataProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </ThemeProvider>
  );
}
