import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useMemo } from 'react';
import type { ProjectBundle, Role } from '@lookahead/shared';
import { api } from './api';
import { toast } from '../components/ui';

export function usePid() {
  return useParams().pid!;
}

export function useBundle(pid = usePid()) {
  return useQuery({
    queryKey: ['bundle', pid],
    queryFn: () => api<ProjectBundle>(`/projects/${pid}`),
    refetchInterval: 60_000,
  });
}

/** Lookups for the current bundle: names by id, members, permissions. */
export function useLookups(b: ProjectBundle | undefined) {
  return useMemo(() => {
    const m = <T extends { id: string }>(xs: T[] | undefined) => new Map((xs ?? []).map((x) => [x.id, x]));
    const role: Role = b?.myRole ?? 'owner_viewer';
    return {
      activity: m(b?.activities),
      task: m(b?.tasks),
      trade: m(b?.trades),
      area: m(b?.areas),
      system: m(b?.systems),
      equipment: m(b?.equipment),
      milestone: m(b?.milestones),
      constraint: m(b?.constraints),
      member: new Map((b?.members ?? []).map((x) => [x.userId, x])),
      role,
      isSuper: role === 'super',
      canCreateConstraint: ['super', 'pm', 'field_engineer', 'foreman', 'cxa'].includes(role),
      canEditEquipment: ['super', 'pm', 'field_engineer'].includes(role),
      canConfirmGate: ['super', 'cxa'].includes(role),
      readOnly: role === 'owner_viewer',
    };
  }, [b]);
}

/** Run an API call, refresh the project, and toast errors. */
export function useAct(pid = usePid()) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method?: string; body?: unknown; ok?: string }) => api(path, { method, body }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['bundle', pid] });
      qc.invalidateQueries({ queryKey: ['metrics', pid] });
      qc.invalidateQueries({ queryKey: ['audit', pid] });
      qc.invalidateQueries({ queryKey: ['comments'] });
      if (v.ok) toast(v.ok);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });
  return {
    run: <T = any>(path: string, body?: unknown, method?: string, ok?: string) => m.mutateAsync({ path, body, method, ok }) as Promise<T>,
    pending: m.isPending,
  };
}
