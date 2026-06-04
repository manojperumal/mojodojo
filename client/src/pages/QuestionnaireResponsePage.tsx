import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, CheckCircle } from 'lucide-react'
import {
  useAssignment,
  useQuestionnaireQuestions,
  useAssignmentResponses,
  useUpsertResponse,
  useUpdateAssignmentStatus,
  type Question,
} from '../hooks/useQuestionnaires'

// ─── Question renderers ───────────────────────────────────────────────────────

function RadioYesNo({ questionId, value, onChange }: { questionId: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-6 mt-2">
      {(['yes', 'no'] as const).map(opt => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="radio"
            name={questionId}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-sm text-gray-700 capitalize">{opt}</span>
        </label>
      ))}
    </div>
  )
}

function MultiSelect({ question, value, onChange }: { question: Question; value: string; onChange: (v: string) => void }) {
  const selected: string[] = value ? JSON.parse(value) : []

  function toggle(opt: string) {
    const next = selected.includes(opt)
      ? selected.filter(s => s !== opt)
      : [...selected, opt]
    onChange(JSON.stringify(next))
  }

  return (
    <div className="mt-2 space-y-2">
      {(question.options ?? []).map(opt => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuestionnaireResponsePage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const id = assignmentId ?? ''

  const { data: assignment, isLoading: loadingA } = useAssignment(id)
  const { data: questions, isLoading: loadingQ } = useQuestionnaireQuestions(assignment?.questionnaire_id ?? '')
  const { data: existingResponses, isLoading: loadingR } = useAssignmentResponses(id)

  const upsertResponse = useUpsertResponse()
  const updateStatus = useUpdateAssignmentStatus()

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  // Initialize from existing responses
  useEffect(() => {
    if (existingResponses) {
      const init: Record<string, string> = {}
      for (const r of existingResponses) {
        init[r.question_id] = r.value
      }
      setAnswers(init)
    }
  }, [existingResponses])

  const isLoading = loadingA || loadingQ || loadingR
  const answeredCount = Object.values(answers).filter(v => v !== '').length
  const totalCount = questions?.length ?? 0

  async function handleSave() {
    if (!questions) return
    setSaving(true)
    try {
      for (const q of questions) {
        const val = answers[q.id]
        if (val !== undefined) {
          await upsertResponse.mutateAsync({ assignment_id: id, question_id: q.id, value: val })
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    await handleSave()
    setSubmitting(true)
    try {
      await updateStatus.mutateAsync({ assignmentId: id, status: 'submitted' })
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="p-6 text-center text-gray-400">Loading questionnaire…</div>
  }

  if (!assignment || !questions) {
    return <div className="p-6 text-center text-red-500">Assignment not found.</div>
  }

  if (assignment.status === 'submitted' || assignment.status === 'approved') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
          <Link to="../../" className="hover:text-gray-700">My Assignments</Link>
        </nav>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <CheckCircle className="mx-auto text-green-500 mb-3" size={40} />
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Already submitted</h2>
          <p className="text-gray-500 text-sm">This questionnaire has been submitted and cannot be edited.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
        <Link to="../../" className="hover:text-gray-700">My Assignments</Link>
        <ChevronRight size={14} />
        <span>Respond</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{assignment.questionnaire_title}</h1>
        {assignment.project_name && (
          <p className="text-gray-500 text-sm mt-1">Project: {assignment.project_name}</p>
        )}
        {assignment.due_date && (
          <p className="text-gray-500 text-sm">Due: {new Date(assignment.due_date).toLocaleDateString()}</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-5">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600 font-medium">{answeredCount} of {totalCount} answered</span>
          <span className="text-gray-400">{totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: totalCount > 0 ? `${(answeredCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4 mb-6">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm font-medium text-gray-800 mb-1">
              <span className="text-gray-400 mr-2">{idx + 1}.</span>
              {q.text}
              {q.required && <span className="text-red-500 ml-1">*</span>}
            </p>

            {q.answer_type === 'radio_yes_no' && (
              <RadioYesNo
                questionId={q.id}
                value={answers[q.id] ?? ''}
                onChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
              />
            )}

            {q.answer_type === 'multi_select' && (
              <MultiSelect
                question={q}
                value={answers[q.id] ?? '[]'}
                onChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
              />
            )}

            {q.answer_type === 'text_area' && (
              <textarea
                className="border border-gray-300 rounded-lg p-2 w-full mt-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[80px]"
                placeholder="Your answer…"
                value={answers[q.id] ?? ''}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
              />
            )}

            {q.answer_type === 'number' && (
              <input
                type="number"
                className="border border-gray-300 rounded-lg p-2 w-full mt-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a number"
                value={answers[q.id] ?? ''}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
              />
            )}

            {q.answer_type === 'document_upload' && (
              <div className="mt-2">
                <input
                  type="file"
                  className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  onChange={e => {
                    const filename = e.target.files?.[0]?.name ?? ''
                    setAnswers(prev => ({ ...prev, [q.id]: filename }))
                  }}
                />
                {answers[q.id] && (
                  <p className="text-xs text-gray-400 mt-1">Selected: {answers[q.id]}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-green-600 font-medium h-5">
          {saved && 'Saved!'}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || submitting}
            className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Progress'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || submitting}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
