import { AlertTriangle, ArrowLeft, BedDouble, Check, ChevronRight, StickyNote, Utensils, Wrench, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HubState = "empty" | "partial" | "done";
type ModuleId = "utensils" | "linen" | "suppliers" | "pending";

const STATES: { id: HubState; label: string }[] = [
  { id: "empty", label: "Vazio" },
  { id: "partial", label: "Parcial" },
  { id: "done", label: "Concluído" },
];

const MODULES: Record<ModuleId, { title: string; icon: typeof Utensils; status: Record<HubState, string>; progress: Record<HubState, number> }> = {
  utensils: { title: "Utensílios", icon: Utensils, status: { empty: "Ainda não iniciado", partial: "12 de 32 respondidos", done: "32 de 32 respondidos" }, progress: { empty: 0, partial: 37, done: 100 } },
  linen: { title: "Enxoval", icon: BedDouble, status: { empty: "Ainda não iniciado", partial: "Ainda não iniciado", done: "18 de 18 respondidos" }, progress: { empty: 0, partial: 0, done: 100 } },
  suppliers: { title: "Fornecedores", icon: Wrench, status: { empty: "Ainda não iniciado", partial: "2 de 6 definidos", done: "6 de 6 definidos" }, progress: { empty: 0, partial: 33, done: 100 } },
  pending: { title: "Pendências", icon: AlertTriangle, status: { empty: "Nada por enquanto", partial: "4 itens", done: "Tudo resolvido" }, progress: { empty: 0, partial: 0, done: 100 } },
};

const PENDING = [
  { origin: "Utensílios", module: "utensils" as ModuleId, items: ["Taças de vinho · faltam 2", "Jogo de panelas · vai comprar"] },
  { origin: "Fornecedores", module: "suppliers" as ModuleId, items: ["Limpeza · a definir", "Manutenção · a definir"] },
];

export function Stage4Hub() {
  const [state, setState] = useState<HubState>("partial");
  const [open, setOpen] = useState<ModuleId | null>(null);
  const [saved, setSaved] = useState<ModuleId | null>(null);
  const [note, setNote] = useState(false);

  const back = () => {
    const from = open === "pending" ? null : open;
    setOpen(null);
    if (from) {
      setSaved(from);
      window.setTimeout(() => setSaved((c) => (c === from ? null : c)), 1800);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[880px] pb-28">
      <div className="mb-5 flex gap-2" aria-label="Estado de demonstração">
        {STATES.map((s) => (
          <Button key={s.id} size="sm" variant={state === s.id ? "default" : "outline"} className="rounded-full" onClick={() => { setState(s.id); setOpen(null); }}>
            {s.label}
          </Button>
        ))}
      </div>

      {open ? (
        <ModuleScreen id={open} onBack={back} onOpen={setOpen} />
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-muted)]">Etapa 4 de 5 · Implantação</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--portal-navy)] md:text-3xl">Implantação</h1>
          <p className="mt-1 text-sm text-[var(--portal-muted)]">O que você quer registrar agora?</p>

          {state === "done" && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[var(--portal-success-soft)] px-4 py-3 text-sm font-medium text-[var(--portal-success)]">
              <Check className="h-4 w-4 shrink-0" /> Implantação pronta para revisão
            </div>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {(Object.keys(MODULES) as ModuleId[]).map((id) => (
              <HubCard key={id} id={id} state={state} saved={saved === id} onOpen={() => setOpen(id)} />
            ))}
          </div>

          <button type="button" onClick={() => setNote(true)} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--portal-navy)] underline-offset-4 hover:underline">
            <StickyNote className="h-4 w-4" /> Adicionar nota
          </button>
        </>
      )}

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--portal-border)] bg-[var(--portal-surface)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[880px] gap-3">
          <Button variant="outline" className="h-12 flex-1">Voltar</Button>
          <Button className="h-12 flex-[2]">{state === "done" ? "Continuar para etapa 5" : "Continuar"}</Button>
        </div>
      </footer>

      {note && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[var(--portal-navy)]/40 md:items-center" onClick={() => setNote(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-[var(--portal-surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--portal-navy)]">Nota da implantação</h2>
              <button type="button" aria-label="Fechar" onClick={() => setNote(false)} className="grid h-10 w-10 place-items-center rounded-full"><X className="h-5 w-5" /></button>
            </div>
            <textarea rows={4} placeholder="Escreva uma observação rápida..." className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-3 text-sm outline-none" />
            <Button className="mt-4 h-12 w-full" onClick={() => setNote(false)}>Salvar nota</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function HubCard({ id, state, saved, onOpen }: { id: ModuleId; state: HubState; saved: boolean; onOpen: () => void }) {
  const m = MODULES[id];
  const Icon = m.icon;
  const idle = id === "pending" && state !== "partial";
  const done = state === "done";
  const progress = m.progress[state];
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={idle && !done}
      className={cn(
        "grid min-h-[88px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-3xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-4 text-left transition-colors hover:border-[var(--portal-navy)]/30",
        idle && !done && "opacity-60",
      )}
    >
      <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", id === "pending" && state === "partial" ? "bg-[var(--portal-surface-soft)] text-[var(--portal-navy)]" : done ? "bg-[var(--portal-success-soft)] text-[var(--portal-success)]" : "bg-[var(--portal-surface-soft)] text-[var(--portal-navy)]")}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-base font-semibold text-[var(--portal-navy)]">{m.title}</span>
          {done && <span className="shrink-0 rounded-full bg-[var(--portal-success-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--portal-success)]">Concluído</span>}
        </span>
        <span className="mt-0.5 block truncate text-sm text-[var(--portal-muted)]">{saved ? "✓ Salvo" : m.status[state]}</span>
        {id !== "pending" && state === "partial" && progress > 0 && (
          <span className="mt-2 block h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-[var(--portal-surface-soft)]">
            <span className="block h-full rounded-full bg-[var(--portal-success)]" style={{ width: `${progress}%` }} />
          </span>
        )}
      </span>
      {!(idle && !done) && <ChevronRight className="h-5 w-5 shrink-0 text-[var(--portal-muted)]" />}
    </button>
  );
}

function ModuleScreen({ id, onBack, onOpen }: { id: ModuleId; onBack: () => void; onOpen: (id: ModuleId) => void }) {
  const m = MODULES[id];
  return (
    <div>
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--portal-navy)]">
        <ArrowLeft className="h-4 w-4" /> Voltar à Implantação
      </button>
      <h1 className="mt-3 text-2xl font-semibold text-[var(--portal-navy)]">{m.title}</h1>
      {id === "pending" ? (
        <div className="mt-5 space-y-5">
          {PENDING.map((g) => (
            <section key={g.origin}>
              <p className="mb-2 text-xs font-semibold uppercase text-[var(--portal-muted)]">{g.origin}</p>
              <div className="space-y-2">
                {g.items.map((it) => (
                  <button key={it} type="button" onClick={() => onOpen(g.module)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] px-4 text-left text-sm text-[var(--portal-navy)]">
                    <span className="min-w-0 truncate">{it}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--portal-muted)]" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-5 grid min-h-[280px] place-items-center rounded-3xl border border-dashed border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 text-center text-sm text-[var(--portal-muted)]">
          Aqui abre a tela já aprovada de {m.title}.<br />Ao voltar, o hub mostra o status atualizado.
        </div>
      )}
    </div>
  );
}
