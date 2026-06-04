import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnswerType = 'radio_yes_no' | 'multi_select' | 'text_area' | 'number' | 'document_upload'

export interface QuestionnaireTemplate {
  id: string
  title: string
  description?: string
  created_at: string
  updated_at: string
}

export interface Question {
  id: string
  questionnaire_id: string
  text: string
  answer_type: AnswerType
  options?: string[]
  required: boolean
  order: number
}

export type AssignmentStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected' | 'more_info_requested'

export interface Assignment {
  id: string
  questionnaire_id: string
  questionnaire_title?: string
  project_id: string
  project_name?: string
  assignee_email: string
  due_date?: string
  status: AssignmentStatus
  created_at: string
  updated_at: string
}

export interface AssignmentResponse {
  id: string
  assignment_id: string
  question_id: string
  value: string
  updated_at: string
}

export interface CreateAssignmentInput {
  questionnaire_id: string
  project_id: string
  assignee_email: string
  due_date?: string
}

export interface UpsertResponseInput {
  assignment_id: string
  question_id: string
  value: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_TEMPLATES: QuestionnaireTemplate[] = [
  { id: 'q1', title: 'Safety Pre-Qualification', description: 'Standard safety questionnaire', created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 'q2', title: 'Financial Capability', description: 'Financial health assessment', created_at: '2026-01-02', updated_at: '2026-01-02' },
  { id: 'q3', title: 'Insurance & Compliance', description: 'Insurance and regulatory compliance', created_at: '2026-01-03', updated_at: '2026-01-03' },
]

const MOCK_QUESTIONS: Question[] = [
  { id: 'qu1', questionnaire_id: 'q1', text: 'Does your company have an active safety program?', answer_type: 'radio_yes_no', required: true, order: 1 },
  { id: 'qu2', questionnaire_id: 'q1', text: 'Which safety certifications do you hold?', answer_type: 'multi_select', options: ['OSHA 10', 'OSHA 30', 'ISO 45001', 'NEBOSH', 'None'], required: true, order: 2 },
  { id: 'qu3', questionnaire_id: 'q1', text: 'Describe your incident reporting process.', answer_type: 'text_area', required: true, order: 3 },
  { id: 'qu4', questionnaire_id: 'q1', text: 'Total recordable incident rate (TRIR) for last year?', answer_type: 'number', required: true, order: 4 },
  { id: 'qu5', questionnaire_id: 'q1', text: 'Upload your safety policy document.', answer_type: 'document_upload', required: false, order: 5 },
  { id: 'qu6', questionnaire_id: 'q2', text: 'Annual revenue (USD)?', answer_type: 'number', required: true, order: 1 },
  { id: 'qu7', questionnaire_id: 'q2', text: 'Upload your most recent financial statement.', answer_type: 'document_upload', required: true, order: 2 },
]

const MOCK_ASSIGNMENTS: Assignment[] = [
  { id: 'a1', questionnaire_id: 'q1', questionnaire_title: 'Safety Pre-Qualification', project_id: 'p1', project_name: 'Downtown Tower', assignee_email: 'contractor@example.com', due_date: '2026-07-01', status: 'submitted', created_at: '2026-06-01', updated_at: '2026-06-01' },
  { id: 'a2', questionnaire_id: 'q2', questionnaire_title: 'Financial Capability', project_id: 'p1', project_name: 'Downtown Tower', assignee_email: 'contractor@example.com', due_date: '2026-07-15', status: 'pending', created_at: '2026-06-01', updated_at: '2026-06-01' },
]

const MOCK_RESPONSES: AssignmentResponse[] = [
  { id: 'r1', assignment_id: 'a1', question_id: 'qu1', value: 'yes', updated_at: '2026-06-02' },
  { id: 'r2', assignment_id: 'a1', question_id: 'qu2', value: '["OSHA 10","OSHA 30"]', updated_at: '2026-06-02' },
  { id: 'r3', assignment_id: 'a1', question_id: 'qu3', value: 'All incidents are reported immediately to the site supervisor...', updated_at: '2026-06-02' },
  { id: 'r4', assignment_id: 'a1', question_id: 'qu4', value: '0.8', updated_at: '2026-06-02' },
]

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useQuestionnaires() {
  return useQuery<QuestionnaireTemplate[]>({
    queryKey: ['questionnaires'],
    queryFn: async () => {
      await new Promise(r => setTimeout(r, 200))
      return MOCK_TEMPLATES
    },
  })
}

export function useQuestionnaire(id: string) {
  return useQuery<QuestionnaireTemplate>({
    queryKey: ['questionnaires', id],
    queryFn: async () => {
      await new Promise(r => setTimeout(r, 200))
      const t = MOCK_TEMPLATES.find(t => t.id === id)
      if (!t) throw new Error('Not found')
      return t
    },
    enabled: !!id,
  })
}

export function useQuestionnaireQuestions(questionnaireId: string) {
  return useQuery<Question[]>({
    queryKey: ['questions', questionnaireId],
    queryFn: async () => {
      await new Promise(r => setTimeout(r, 200))
      return MOCK_QUESTIONS.filter(q => q.questionnaire_id === questionnaireId).sort((a, b) => a.order - b.order)
    },
    enabled: !!questionnaireId,
  })
}

export function useAssignments() {
  return useQuery<Assignment[]>({
    queryKey: ['assignments'],
    queryFn: async () => {
      await new Promise(r => setTimeout(r, 200))
      return MOCK_ASSIGNMENTS
    },
  })
}

export function useAssignment(assignmentId: string) {
  return useQuery<Assignment>({
    queryKey: ['assignments', assignmentId],
    queryFn: async () => {
      await new Promise(r => setTimeout(r, 200))
      const a = MOCK_ASSIGNMENTS.find(a => a.id === assignmentId)
      if (!a) throw new Error('Not found')
      return a
    },
    enabled: !!assignmentId,
  })
}

export function useAssignmentResponses(assignmentId: string) {
  return useQuery<AssignmentResponse[]>({
    queryKey: ['responses', assignmentId],
    queryFn: async () => {
      await new Promise(r => setTimeout(r, 200))
      return MOCK_RESPONSES.filter(r => r.assignment_id === assignmentId)
    },
    enabled: !!assignmentId,
  })
}

export function useCreateAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateAssignmentInput): Promise<Assignment> => {
      await new Promise(r => setTimeout(r, 400))
      const template = MOCK_TEMPLATES.find(t => t.id === input.questionnaire_id)
      const newAssignment: Assignment = {
        id: `a${Date.now()}`,
        questionnaire_id: input.questionnaire_id,
        questionnaire_title: template?.title,
        project_id: input.project_id,
        assignee_email: input.assignee_email,
        due_date: input.due_date,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      MOCK_ASSIGNMENTS.push(newAssignment)
      return newAssignment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
    },
  })
}

export function useUpsertResponse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpsertResponseInput): Promise<AssignmentResponse> => {
      await new Promise(r => setTimeout(r, 200))
      const existing = MOCK_RESPONSES.find(
        r => r.assignment_id === input.assignment_id && r.question_id === input.question_id
      )
      if (existing) {
        existing.value = input.value
        existing.updated_at = new Date().toISOString()
        return existing
      } else {
        const newResponse: AssignmentResponse = {
          id: `r${Date.now()}`,
          assignment_id: input.assignment_id,
          question_id: input.question_id,
          value: input.value,
          updated_at: new Date().toISOString(),
        }
        MOCK_RESPONSES.push(newResponse)
        return newResponse
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['responses', variables.assignment_id] })
    },
  })
}

export function useUpdateAssignmentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ assignmentId, status }: { assignmentId: string; status: AssignmentStatus }): Promise<Assignment> => {
      await new Promise(r => setTimeout(r, 300))
      const assignment = MOCK_ASSIGNMENTS.find(a => a.id === assignmentId)
      if (!assignment) throw new Error('Not found')
      assignment.status = status
      assignment.updated_at = new Date().toISOString()
      return assignment
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['assignments', variables.assignmentId] })
    },
  })
}
