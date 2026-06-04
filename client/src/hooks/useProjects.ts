import { useQuery } from '@tanstack/react-query'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  owner_id: string
  created_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_email: string
  role: 'owner' | 'gc' | 'trade'
  joined_at: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PROJECTS: Project[] = [
  { id: 'p1', name: 'Downtown Tower', description: 'Mixed-use high-rise', status: 'active', owner_id: 'u1', created_at: '2026-01-01' },
  { id: 'p2', name: 'Riverside Offices', description: 'Commercial office complex', status: 'active', owner_id: 'u1', created_at: '2026-02-01' },
  { id: 'p3', name: 'Harbor Bridge Repair', description: 'Bridge maintenance project', status: 'active', owner_id: 'u2', created_at: '2026-03-01' },
]

const MOCK_MEMBERS: ProjectMember[] = [
  { id: 'm1', project_id: 'p1', user_email: 'owner@example.com', role: 'owner', joined_at: '2026-01-01' },
  { id: 'm2', project_id: 'p1', user_email: 'gc@example.com', role: 'gc', joined_at: '2026-01-02' },
  { id: 'm3', project_id: 'p1', user_email: 'contractor@example.com', role: 'trade', joined_at: '2026-01-03' },
]

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useOwnerProjects() {
  return useQuery<Project[]>({
    queryKey: ['owner-projects'],
    queryFn: async () => {
      await new Promise(r => setTimeout(r, 200))
      return MOCK_PROJECTS
    },
  })
}

export function useGCProjects() {
  return useQuery<Project[]>({
    queryKey: ['gc-projects'],
    queryFn: async () => {
      await new Promise(r => setTimeout(r, 200))
      return MOCK_PROJECTS.filter(p => p.id !== 'p3')
    },
  })
}

export function useProjectMembers(projectId: string) {
  return useQuery<ProjectMember[]>({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      await new Promise(r => setTimeout(r, 200))
      return MOCK_MEMBERS.filter(m => m.project_id === projectId)
    },
    enabled: !!projectId,
  })
}

export function useProjects() {
  return useOwnerProjects()
}
