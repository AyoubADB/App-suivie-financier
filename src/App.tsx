import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { PeriodProvider } from './context/PeriodContext';
import { ScopeProvider } from './context/ScopeContext';
import { ThemeProvider } from './context/ThemeContext';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { Subscriptions } from './pages/Subscriptions';
import { TransactionsPage } from './pages/TransactionsPage';

export default function App() {
  return (
    <ThemeProvider>
      <ScopeProvider>
        <PeriodProvider>
          <BrowserRouter>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/perso" element={<TransactionsPage scope="perso" title="Perso" />} />
                <Route path="/pro" element={<TransactionsPage scope="pro" title="Pro" />} />
                <Route path="/abonnements" element={<Subscriptions />} />
                <Route path="/reglages" element={<Settings />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </PeriodProvider>
      </ScopeProvider>
    </ThemeProvider>
  );
}
