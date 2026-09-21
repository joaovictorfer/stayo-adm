/**
 * "Precisamos de atenção" — lista somente o que realmente trava a operação
 * (itens bloqueadores e obrigatórios ainda em aberto). Nenhum texto
 * inventado: cada linha vem de um ImplementationItem real.
 */

import { ArrowRight, AlertTriangle } from "lucide-react";

import { itemStatusLabels } from "../../lib/implementation-status";
import type { ImplementationItem } from "../../types/core";

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

function isOpen(item: ImplementationItem): boolean {
  if (item.status === "concluido" || item.status === "nao_aplicavel") return false;
  if (item.status === "pulado") return !item.readinessOverrideAt;
  return true;
}

export function attentionItems(items: ImplementationItem[]): ImplementationItem[] {
  return items
    .filter((item) => isOpen(item) && (item.blocker || item.mandatory))
    .sort((a, b) => Number(b.blocker) - Number(a.blocker) || a.order - b.order);
}

export function AttentionPanel({ items, onResolve }: { items: ImplementationItem[]; onResolve: () => void }) {
  const pending = attentionItems(items);
  const next = pending[0];

  return (
    <section
      className="grid gap-4 rounded-[var(--radius-card)] border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      style={{ ...surface, borderColor: next ? "var(--stayo-warning)" : "var(--stayo-border)" }}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          <AlertTriangle size={15} className={next ? "text-warning" : "text-success"} />
          Próxima ação recomendada
        </p>
        <h2 className="mt-1.5 font-display text-base font-semibold text-foreground sm:text-lg">
          {next ? next.title : "Nenhuma ação crítica pendente"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {next
            ? `${next.phase} · ${next.blocker ? "Bloqueador" : "Obrigatório"} · ${itemStatusLabels[next.status]}${pending.length > 1 ? ` · mais ${pending.length - 1} pendência(s)` : ""}`
            : "Acompanhe as próximas etapas da implantação pela timeline."}
        </p>
      </div>
      {next && (
        <button type="button" onClick={onResolve} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-brand-strong">
          Resolver agora <ArrowRight size={15} />
        </button>
      )}
    </section>
  );
}
