import { Link, useParams } from 'react-router-dom'
import { ChevronRight, CheckCircle, XCircle, MessageCircle } from 'lucide-react'
import {
  useAssignment,
  useQuestionnaireQuestions,
  useAssignmentResponses,
  useUpdateAssignmentStatus,
  type AssignmentStatus,
  type Question,
  type AssignmentResponse,
} from '../hooks/useQuestionnaires'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AssignmentStatus }) {
  const config: Record<AssignmentStatus, { label: string; className: string }> = {
    pending:              { label: 'Pending',           className: 'bg-gray-100 text-gray-600' },
    in_progress:          { label: 'In Progress',       className: 'bg-blue-100 text-blue-700' },
    submitted:            { label: 'Submitted',         className: 'bg-yellow-100 text-yellow-700' },
    approved:             { label: 'Approved',          className: 'bg-green-100 text-green-700' },
    rejected:             { label: 'Rejected',          className: 'bg-red-100 text-red-700' },
    more_info_requested:  { label: 'More Info Needed',  className: 'bg-amber-100 text-amber-700' },
  }
  const { label, className } = config[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${className}`}>{label}</span>
  )
}

// ─── Answer display ───────────────────────────────────────────────────────────

function AnswerDisplay({ question, response }: { question: Question; response?: AssignmentResponse }) {
  if (!response) {
    return <p className="text-sm text-gray-400 italic">No answer provided</p>
  }

  const { answer_type } = question
  const { value } = response

  if (answer_type === 'radio_yes_no') {
    return (
      <span className={`text-sm font-semibold capitalize ${value === 'yes' ? 'text-green-600' : 'text-red-600'}`}>
        {value}
      </span>
    )
  }

  if (answer_type === 'multi_select') {
    let items: string[] = []
    try { items = JSON.parse(value) } catch { items = [value] }
    if (items.length === 0) return <p className="text-sm text-gray-400 italic">None selected</p>
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {items.map(item => (
          <span key={item} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
            {item}
          </span>
        ))}
      </div>
    )
  }

  if (answer_type === 'document_upload') {
    return (
      <p className="text-sm text-blue-600 underline cursor-pointer">{value || '—'}</p>
    )
  }

  return <p className="text-sm text-gray-800 whitespace-pre-wrap">{value || '—'}</p>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuestionnaireReviewPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const id = assignmentId ?? ''

  const { data: assignment, isLoading: loadingA } = useAssignment(id)
  const { data: questions, isLoading: loadingQ } = useQuestionnaireQuestions(assignment?.questionnaire_id ?? '')
  const { data: responses, isLoading: loadingR } = useAssignmentResponses(id)
  const updateStatus = useUpdateAssignmentStatus()

  const isLoading = loadingA || loadingQ || loadingR

  const responseMap = new Map<string, AssignmentResponse>()
  responses?.forEach(r => responseMap.set(r.question_id, r))

  async function handleAction(status: AssignmentStatus) {
    await updateStatus.mutateAsync({ assignmentId: id, status })
  }

  if (isLoading) {
    return <div className="p-6 text-center text-gray-400">Loading review…</div>
  }

  if (!assignment || !questions) {
    return <div className="p-6 text-center text-red-500">Assignment not found.</div>
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
        <Link to="../../" className="hover:text-gray-700">Assignments</Link>
        <ChevronRight size={14} />
        <span>Review</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{assignment.questionnaire_title}</h1>
          <div className="mt-1 text-sm text-gray-500 space-y-0.5">
            {assignment.project_name && <p>Project: <span className="text-gray-700">{assignment.project_name}</span></p>}
            <p>Submitted by: <span className="text-gray-700">{assignment.assignee_email}</span></p>
            {assignment.due_date && <p>Due: <span className="text-gray-700">{new Date(assignment.due_date).toLocaleDateString()}</span></p>}
          </div>
        </div>
        <StatusBadge status={assignment.status} />
      </div>

      {/* Questions + answers */}
      <div className="space-y-4 mb-8">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm font-medium text-gray-700 mb-2">
              <span className="text-gray-400 mr-2">{idx + 1}.</span>
              {q.text}
              {q.required && <span className="text-red-400 ml-1">*</span>}
            </p>
            <AnswerDisplay question={q} response={responseMap.get(q.id)} />
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {(assignment.status === 'submitted' || assignment.status === 'more_info_requested') && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-700 mb-4">Review decision</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleAction('approved')}
              disabled={updateStatus.isPending}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              <CheckCircle size={16} />
              Approve
            </button>
            <button
              onClick={() => handleAction('more_info_requested')}
              disabled={updateStatus.isPending}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-amber-800 bg-amber-100 rounded-lg hover:bg-amber-200 disabled:opacity-60 transition-colors"
            >
              <MessageCircle size={16} />
              Request More Info
            </button>
            <button
              onClick={() => handleAction('rejected')}
              disabled={updateStatus.isPending}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              <XCircle size={16} />
              Reject
            </button>
          </div>
          {updateStatus.isPending && (
            <p className="text-sm text-gray-400 mt-3">Saving decision…</p>
          )}
          {updateStatus.isSuccess && (
            <p className="text-sm text-green-600 mt-3">Status updated successfully.</p>
          )}
        </div>
      )}

      {(assignment.status === 'approved' || assignment.status === 'rejected') && (
        <div className={`rounded-xl border p-4 text-sm font-medium flex items-center gap-2 ${
          assignment.status === 'approved'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {assignment.status === 'approved' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          This submission has been {assignment.status}.
        </div>
      )}
    </div>
  )
}
