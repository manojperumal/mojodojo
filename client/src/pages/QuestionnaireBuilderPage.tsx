import { Link, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useQuestionnaire, useQuestionnaireQuestions } from '../hooks/useQuestionnaires'

export default function QuestionnaireBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const { data: questionnaire, isLoading } = useQuestionnaire(id ?? '')
  const { data: questions } = useQuestionnaireQuestions(id ?? '')

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
        <Link to="../" className="hover:text-gray-700">Questionnaires</Link>
        <ChevronRight size={14} />
        <span>{isNew ? 'New' : (questionnaire?.title ?? id)}</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isNew ? 'New Questionnaire' : 'Edit Questionnaire'}
      </h1>

      {isLoading && !isNew && (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500 text-sm">
          Questionnaire builder coming soon. Questions: {questions?.length ?? 0}
        </p>
      </div>
    </div>
  )
}
