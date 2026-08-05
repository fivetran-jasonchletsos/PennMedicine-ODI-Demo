import { HashRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import DashboardPage from './pages/DashboardPage';
import AgentPage from './pages/AgentPage';
import AboutAgentPage from './pages/AboutAgentPage';
import PipelinePage from './pages/PipelinePage';
import ExecutivePage from './pages/ExecutivePage';
import MapPage from './pages/MapPage';
import WatchlistPage from './pages/WatchlistPage';
import AboutPage from './pages/AboutPage';
import NotFoundPage from './pages/NotFoundPage';
import OdiDbtWizardPage from './pages/OdiDbtWizardPage';
import WizardLivePage from './pages/WizardLivePage';
import ActivationLivePage from './pages/ActivationLivePage';
import ClarityScenarioPage from './pages/ClarityScenarioPage';
import ClarityOutcomePage from './pages/ClarityOutcomePage';
import ArchitecturePage from './pages/ArchitecturePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/patients/:patId" element={<PatientDetailPage />} />
            <Route path="/executive" element={<ExecutivePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/agent" element={<AgentPage />} />
            <Route path="/about-agent" element={<AboutAgentPage />} />
            <Route path="/architecture" element={<ArchitecturePage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/activations-live" element={<ActivationLivePage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/dbt-wizard" element={<OdiDbtWizardPage />} />
            <Route path="/wizard-live" element={<WizardLivePage />} />
            <Route path="/scenario" element={<ClarityScenarioPage />} />
            <Route path="/outcome" element={<ClarityOutcomePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}
