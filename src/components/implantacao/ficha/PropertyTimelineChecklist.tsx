import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Circle, Loader2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { readPropertyTimeline, updatePropertyTimeline } from '@/lib/api/core-client';
import type { PropertyTimelineStep, TimelineStatus } from '@/lib/property-timeline';

export function PropertyTimelineChecklist({ implementationId }: { implementationId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const key = ['implementation-timeline', implementationId];
  const q = useQuery({ queryKey: key, queryFn: () => readPropertyTimeline(implementationId) });
  const steps = q.data ?? [];
  const completed = steps.filter(s => s.status === 'concluido');
  const remaining = steps.filter(s => s.status !== 'concluido');
  async function change(step: PropertyTimelineStep, status: TimelineStatus) {
    if (busy) return;
    setBusy(step.id);
    try {
      await updatePropertyTimeline(implementationId, step, status);
      await Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: ['property-history', implementationId] })]);
      toast.success(status === 'concluido' ? 'Etapa concluída' : 'Etapa reaberta');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a etapa.');
      await qc.invalidateQueries({ queryKey: key });
    } finally { setBusy(null); }
  }
  function row(step: PropertyTimelineStep) {
    const done = step.status === 'concluido';
    return <li key={step.id} className="relative pb-2 last:pb-0">
      <Button variant="ghost" disabled={Boolean(busy)} aria-label={`${done ? 'Reabrir' : 'Concluir'} etapa: ${step.title}`} aria-pressed={done} onClick={() => void change(step, done ? 'pendente' : 'concluido')} className={`relative h-auto min-h-14 w-full justify-start gap-3 rounded-lg px-2 py-3 text-left ${done ? 'text-muted-foreground' : 'bg-primary/5 hover:bg-primary/10'}`}>
        <span className={`z-10 grid size-8 shrink-0 place-items-center rounded-full border ${done ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-primary'}`}>
          {busy === step.id ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : done ? <Check className="size-4" /> : <Circle className="size-4" />}
        </span>
        <span className="min-w-0 flex-1"><span className="block whitespace-normal break-words text-sm font-semibold">{step.title}</span>{step.notes && <span className="mt-1 block whitespace-normal break-words text-xs text-muted-foreground">{step.notes}</span>}<span className="mt-1 block text-xs text-muted-foreground">{done ? `Concluído${step.done_at ? ` · ${new Date(step.done_at).toLocaleDateString('pt-BR')}` : ''}` : step.status === 'parcial' ? 'Em andamento' : 'Pendente'}</span></span>
        {done ? <Undo2 className="size-4 shrink-0" /> : <Check className="size-4 shrink-0 text-primary" />}
      </Button>
    </li>;
  }
  if (q.isError) return <div className="py-4"><p className="text-sm text-destructive">Não foi possível carregar as etapas.</p><Button variant="outline" size="sm" onClick={() => q.refetch()}>Tentar novamente</Button></div>;
  if (q.isPending) return <p className="py-5 text-sm text-muted-foreground">Carregando etapas…</p>;
  if (!steps.length) return null;
  return <section className="border-b py-5" aria-label="Etapas do imóvel">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Linha do tempo</h3><span className="text-xs font-medium text-muted-foreground">{completed.length} de {steps.length} concluídas</span></div>
    <Progress value={steps.length ? completed.length / steps.length * 100 : 0} aria-label="Etapas concluídas" className="mb-5 h-1.5" />
    {remaining.length ? <ol className="relative space-y-1 before:absolute before:bottom-6 before:left-6 before:top-6 before:w-px before:bg-border">{remaining.map(row)}</ol> : <p className="flex items-center gap-2 py-2 text-sm text-primary"><Check className="size-4" />Todas as etapas concluídas</p>}
    {completed.length > 0 && <><Button variant="ghost" size="sm" className="mt-3 text-muted-foreground" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}><ChevronDown className={`size-4 ${showDone ? 'rotate-180' : ''}`} />Concluídas ({completed.length})</Button>{showDone && <ol className="mt-2">{completed.map(row)}</ol>}</>}
  </section>;
}