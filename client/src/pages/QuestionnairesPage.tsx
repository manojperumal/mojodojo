import { Link } from 'react-router-dom'
import { Plus, FileText, ChevronRight } from 'lucide-react'
import { useQuestionnaires } from '../hooks/useQuestionnaires'

export default function QuestionnairesPage() {
  const { data: questionnaires, isLoading, isError } = useQuestionnaires()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
        <span>Questionnaires</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Questionnaires</h1>
          <p className="text-gray-500 text-sm mt-1">Manage pre-qualification questionnaire templates</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="assign"
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Assign
          </Link>
          <Link
            to="new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            New Questionnaire
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-400">Loading questionnaires…</div>
      )}

      {isError && (
        <div className="text-center py-12 text-red-500">Failed to load questionnaires.</div>
      )}

      {questionnaires && questionnaires.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No questionnaires yet. Create your first one.
        </div>
      )}

      {questionnaires && questionnaires.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {questionnaires.map(q => (
            <Link
              key={q.id}
              to={q.id}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{q.title}</p>
                {q.description && (
                  <p className="text-sm text-gray-500 truncate">{q.description}</p>
                )}
              </div>
              <div className="text-xs text-gray-400 shrink-0">
                Updated {new Date(q.updated_at).toLocaleDateString()}
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-400 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
