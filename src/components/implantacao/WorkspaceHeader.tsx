/**
 * Cabeçalho contextual do workspace de implantação (Fase B do plano).
 *
 * Responde de relance: onde estamos, quanto já foi feito, se está apta e
 * quantas pendências existem. Progresso e prontidão NUNCA se fundem numa
 * barra só — são conceitos distintos (ver implementation-status.ts).
 */

import { Check, Copy, FileText, ExternalLink } from "lucide-react";
import { useState } from "react";

import { statusLabels } from "../../lib/implementation-status";
import type { ImplementationProject } from "../../types/core";

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div
      className="rounded-[var(--radius-control)] border px-3 py-2"
      style={{ ...surface, borderColor: "var(--stayo-border)" }}
    >
      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </p>
      <p
        className="mt-0.5 text-lg leading-tight"
        style={{
          fontFamily: "var(--stayo-font-display)",
          color: tone ?? "var(--stayo-ink)",
        }}
      >
        {value}
      </p>
      {hint && (
        <p className="text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-1.5 text-sm"
      style={{ ...surface, color: "var(--stayo-ink)" }}
    >
      {icon}
      {children}
    </button>
  );
}

export function WorkspaceHeader({
  implementation,
  progressPercent,
  progressDone,
  progressTotal,
  ready,
  pendingCount,
  onOpenProposal,
  onOpenPortal,
}: {
  implementation: ImplementationProject;
  progressPercent: number;
  progressDone: number;
  progressTotal: number;
  ready: boolean;
  pendingCount: number;
  onOpenProposal: () => void;
  onOpenPortal: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const place = [implementation.condominiumName, implementation.unit]
    .filter(Boolean)
    .join(" • ");

  return (
    <section className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-xl leading-tight"
            style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
          >
            {implementation.code}
          </p>
          <p className="text-sm" style={{ color: "var(--stayo-ink)" }}>
            {place || implementation.nickname || "Imóvel ainda sem identificação"}
          </p>
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            {implementation.ownerName || "Proprietário não informado"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onOpenPortal} icon={<ExternalLink size={14} />}>
            Portal
          </ActionButton>
          <ActionButton
            onClick={() => {
              if (typeof window !== "undefined") {
                void navigator.clipboard?.writeText(window.location.href);
              }
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }}
            icon={copied ? <Check size={14} /> : <Copy size={14} />}
          >
            {copied ? "Link copiado" : "Compartilhar"}
          </ActionButton>
          <ActionButton onClick={onOpenProposal} icon={<FileText size={14} />}>
            Gerar documento
          </ActionButton>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Status" value={statusLabels[implementation.status]} />
        <Metric
          label="Progresso"
          value={`${progressPercent}%`}
          hint={`${progressDone} de ${progressTotal} itens concluídos`}
        />
        <Metric
          label="Prontidão"
          value={ready ? "Apta" : "Não apta"}
          tone={ready ? "var(--stayo-success)" : "var(--stayo-danger)"}
          hint="Não é o mesmo que progresso"
        />
        <Metric
          label="Pendências"
          value={String(pendingCount)}
          tone={pendingCount > 0 ? "var(--stayo-warning)" : "var(--stayo-ink)"}
          hint="Itens obrigatórios ou bloqueadores em aberto"
        />
      </div>
    </section>
  );
}
