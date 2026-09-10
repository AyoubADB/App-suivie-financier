import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { PeriodProvider } from './context/PeriodContext';
import { ScopeProvider } from './context/ScopeContext';
import { SettingsProvider } from './context/SettingsContext';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Movements } from './pages/Movements';
import { Onboarding } from './pages/Onboarding';
import { SectionView } from './pages/SectionView';
import { Settings } from './pages/Settings';
import { useSettings } from './context/SettingsContext';

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
      <SettingsProvider>
        <Routed />
      </SettingsProvider>
    </DataProvider>
  );
}

/** Routes et navigation, dépendantes des préférences donc rendues sous <SettingsProvider>. */
function Routed() {
  const { onboarded, proEnabled } = useSettings();
  const { mode } = useAuth();

  // Le questionnaire d'accueil ne concerne que les comptes : en mode local,
  // on entre directement dans l'application.
  if (mode === 'cloud' && !onboarded) return <Onboarding />;

  return (
    <ScopeProvider>
      <PeriodProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/vue/:slug" element={<SectionView />} />
              <Route path="/reglages" element={<Settings />} />
              {proEnabled ? (
                <>
                  <Route path="/perso" element={<Movements scope="perso" />} />
                  <Route path="/pro" element={<Movements scope="pro" />} />
                  <Route path="/mouvements" element={<Navigate to="/perso" replace />} />
                </>
              ) : (
                <>
                  <Route path="/mouvements" element={<Movements scope="perso" />} />
                  <Route path="/perso" element={<Navigate to="/mouvements" replace />} />
                  <Route path="/pro" element={<Navigate to="/mouvements" replace />} />
                </>
              )}
              <Route path="/abonnements" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </PeriodProvider>
    </ScopeProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
