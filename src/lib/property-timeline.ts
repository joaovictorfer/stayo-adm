export const DEFAULT_TIMELINE_STEPS = [
  'Captação do imóvel',
  'Criação de proposta',
  'Reunião comercial',
  'Visita ao imóvel',
  'Limpeza inicial',
  'Limpeza de estofado',
  'Blindagem de estofado',
  'Vistoria de implantação',
  'Proposta aceita',
  'Assinatura de contrato',
  'Autorização síndico',
  'Autorização no condomínio',
  'Fotos do imóvel',
  'Criação do anúncio',
  'Anúncio ativo',
] as const;

export type TimelineStatus = 'pendente' | 'parcial' | 'concluido';
export interface PropertyTimelineStep { id: string; title: string; position: number; done_at: string | null; status: TimelineStatus; notes: string | null; }

export function timelineStatusPatch(step: Pick<PropertyTimelineStep, 'done_at'>, status: TimelineStatus, now: string) {
  return { status, done_at: status === 'concluido' ? step.done_at ?? now : null };
}