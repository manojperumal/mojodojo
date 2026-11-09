import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Spinner } from './components/ui';
import { ProjectLayout } from './components/ProjectLayout';
import { LoginPage } from './pages/Login';
import { ProjectsPage } from './pages/Projects';
import { BoardPage } from './pages/Board';
import { HuddlePage } from './pages/Huddle';
import { ConstraintsPage } from './pages/Constraints';
import { WeeklyPlanPage } from './pages/WeeklyPlan';
import { EquipmentPage } from './pages/Equipment';
import { CommissioningPage } from './pages/Commissioning';
import { MetricsPage } from './pages/Metrics';
import { ImportPage } from './pages/Import';
import { SetupPage } from './pages/Setup';
import { ForemanPage } from './pages/Foreman';
import { PrintBoardPage, PrintConstraintsPage } from './pages/Print';

function Protected({ children }: { children: JSX.Element }) {
  const { me, loading } = useAuth();
  if (loading && !me) return <Spinner />;
  if (!me) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/f/:token" element={<ForemanPage />} />
      <Route path="/" element={<Protected><ProjectsPage /></Protected>} />
      <Route path="/p/:pid/print/board" element={<Protected><PrintBoardPage /></Protected>} />
      <Route path="/p/:pid/print/constraints" element={<Protected><PrintConstraintsPage /></Protected>} />
      <Route path="/p/:pid" element={<Protected><ProjectLayout /></Protected>}>
        <Route index element={<BoardPage />} />
        <Route path="huddle" element={<HuddlePage />} />
        <Route path="constraints" element={<ConstraintsPage />} />
        <Route path="plan" element={<WeeklyPlanPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="commissioning" element={<CommissioningPage />} />
        <Route path="metrics" element={<MetricsPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="setup" element={<SetupPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
