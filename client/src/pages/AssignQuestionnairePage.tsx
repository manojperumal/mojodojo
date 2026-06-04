import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useQuestionnaires, useCreateAssignment } from '../hooks/useQuestionnaires'
import { useOwnerProjects } from '../hooks/useProjects'

export default function AssignQuestionnairePage() {
  const navigate = useNavigate()
  const { data: questionnaires, isLoading: loadingQ } = useQuestionnaires()
  const { data: projects, isLoading: loadingP } = useOwnerProjects()
  const createAssignment = useCreateAssignment()

  const [questionnaireId, setQuestionnaireId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [assigneeEmail, setAssigneeEmail] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!questionnaireId || !projectId || !assigneeEmail) {
      setError('Please fill in all required fields.')
      return
    }

    try {
      await createAssignment.mutateAsync({
        questionnaire_id: questionnaireId,
        project_id: projectId,
        assignee_email: assigneeEmail,
        due_date: dueDate || undefined,
      })
      navigate(-1)
    } catch {
      setError('Failed to create assignment. Please try again.')
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
        <Link to="../" className="hover:text-gray-700">Questionnaires</Link>
        <ChevronRight size={14} />
        <span>Assign</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Assign Questionnaire</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
        {/* Questionnaire selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Questionnaire <span className="text-red-500">*</span>
          </label>
          {loadingQ ? (
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <select
              value={questionnaireId}
              onChange={e => setQuestionnaireId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a questionnaire…</option>
              {questionnaires?.map(q => (
                <option key={q.id} value={q.id}>{q.title}</option>
              ))}
            </select>
          )}
        </div>

        {/* Project selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project <span className="text-red-500">*</span>
          </label>
          {loadingP ? (
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a project…</option>
              {projects?.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Assignee email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Assignee Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={assigneeEmail}
            onChange={e => setAssigneeEmail(e.target.value)}
            placeholder="contractor@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Due date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Due Date <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createAssignment.isPending}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {createAssignment.isPending ? 'Assigning…' : 'Assign Questionnaire'}
          </button>
        </div>
      </form>
    </div>
  )
}
