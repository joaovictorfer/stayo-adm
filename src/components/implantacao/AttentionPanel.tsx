/**
 * "Precisamos de atenção" — lista somente o que realmente trava a operação
 * (itens bloqueadores e obrigatórios ainda em aberto). Nenhum texto
 * inventado: cada linha vem de um ImplementationItem real.
 */

import { AlertTriangle } from "lucide-react";

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
    .sort((a, b) => Number(b.blocker) - Number(a.blocker) || a.displayOrder - b.displayOrder);
}

export function AttentionPanel({ items }: { items: ImplementationItem[] }) {
  const pending = attentionItems(items);
  if (pending.length === 0) return null;

  return (
    <section
      className="rounded-[var(--radius-card)] border p-4"
      style={{ ...surface, borderColor: "var(--stayo-warning)" }}
    >
      <h2
        className="mb-2 flex items-center gap-2 text-sm"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
      >
        <AlertTriangle size={15} style={{ color: "var(--stayo-warning)" }} />
        Precisamos de atenção
      </h2>
      <ul className="flex flex-col gap-1.5">
        {pending.slice(0, 8).map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span style={{ color: "var(--stayo-ink)" }}>{item.title}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px]"
              style={{
                backgroundColor: item.blocker ? "var(--stayo-gold-soft)" : "var(--stayo-forest-soft)",
                color: item.blocker ? "var(--stayo-warning)" : "var(--stayo-ink-muted)",
              }}
            >
              {item.blocker ? "Bloqueador" : "Obrigatório"}
            </span>
            <span className="text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>
              {item.phase} · {itemStatusLabels[item.status]}
            </span>
          </li>
        ))}
      </ul>
      {pending.length > 8 && (
        <p className="mt-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          e mais {pending.length - 8} item(ns) na aba Checklist.
        </p>
      )}
    </section>
  );
}
