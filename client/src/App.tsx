import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Sidebar from './components/Sidebar'
import QuestionnairesPage from './pages/QuestionnairesPage'
import QuestionnaireBuilderPage from './pages/QuestionnaireBuilderPage'
import QuestionBankPage from './pages/QuestionBankPage'
import AssignQuestionnairePage from './pages/AssignQuestionnairePage'
import QuestionnaireResponsePage from './pages/QuestionnaireResponsePage'
import QuestionnaireReviewPage from './pages/QuestionnaireReviewPage'

const queryClient = new QueryClient()

// ─── Layout wrappers ──────────────────────────────────────────────────────────

function OwnerLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="owner" />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function GCLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="gc" />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function TradeLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="trade" />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

// ─── Placeholder pages ────────────────────────────────────────────────────────

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500">This page is coming soon.</p>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/owner/questionnaires" replace />} />

          {/* ── Owner routes ── */}
          <Route path="/owner" element={<OwnerLayout />}>
            <Route index element={<Navigate to="questionnaires" replace />} />
            <Route path="dashboard" element={<Placeholder title="Owner Dashboard" />} />
            <Route path="projects" element={<Placeholder title="Projects" />} />
            <Route path="members" element={<Placeholder title="Members" />} />
            <Route path="trades" element={<Placeholder title="Trades" />} />
            <Route path="questionnaires" element={<QuestionnairesPage />} />
            <Route path="questionnaires/new" element={<QuestionnaireBuilderPage />} />
            <Route path="questionnaires/assign" element={<AssignQuestionnairePage />} />
            <Route path="questionnaires/:id" element={<QuestionnaireBuilderPage />} />
            <Route path="question-bank" element={<QuestionBankPage />} />
            <Route path="assignments/:assignmentId/review" element={<QuestionnaireReviewPage />} />
          </Route>

          {/* ── GC routes ── */}
          <Route path="/gc" element={<GCLayout />}>
            <Route index element={<Navigate to="questionnaires" replace />} />
            <Route path="dashboard" element={<Placeholder title="GC Dashboard" />} />
            <Route path="projects" element={<Placeholder title="GC Projects" />} />
            <Route path="trades" element={<Placeholder title="GC Trades" />} />
            <Route path="profile" element={<Placeholder title="My Profile" />} />
            <Route path="questionnaires" element={<QuestionnairesPage />} />
            <Route path="questionnaires/new" element={<QuestionnaireBuilderPage />} />
            <Route path="questionnaires/assign" element={<AssignQuestionnairePage />} />
            <Route path="questionnaires/:id" element={<QuestionnaireBuilderPage />} />
            <Route path="assignments/:assignmentId/review" element={<QuestionnaireReviewPage />} />
          </Route>

          {/* ── Trade routes ── */}
          <Route path="/trade" element={<TradeLayout />}>
            <Route index element={<Navigate to="assignments" replace />} />
            <Route path="dashboard" element={<Placeholder title="Trade Dashboard" />} />
            <Route path="assignments" element={<Placeholder title="My Assignments" />} />
            <Route path="profile" element={<Placeholder title="My Profile" />} />
            <Route path="assignments/:assignmentId/respond" element={<QuestionnaireResponsePage />} />
            <Route path="assignments/:assignmentId/review" element={<QuestionnaireReviewPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
