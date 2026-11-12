export type TimelineStatus = 'pendente' | 'parcial' | 'concluido';
export interface PropertyTimelineStep { id: string; title: string; position: number; done_at: string | null; status: TimelineStatus; notes: string | null; }

export function timelineStatusPatch(step: Pick<PropertyTimelineStep, 'done_at'>, status: TimelineStatus, now: string) {
  return { status, done_at: status === 'concluido' ? step.done_at ?? now : null };
}