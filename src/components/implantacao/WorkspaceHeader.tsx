/**
 * Cabeçalho contextual do workspace de implantação (Fase B do plano).
 *
 * Responde de relance: onde estamos, quanto já foi feito, se está apta e
 * quantas pendências existem. Progresso e prontidão NUNCA se fundem numa
 * barra só — são conceitos distintos (ver implementation-status.ts).
 */

import { Check, Copy, FileText, ExternalLink, MapPin } from "lucide-react";
import { useState } from "react";

import { statusLabels, type ReadinessResult } from "../../lib/implementation-status";
import type { ImplementationProject } from "../../types/core";

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
    <div className="rounded-[var(--radius-control)] border border-primary-foreground/10 bg-primary-foreground/[0.06] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase text-primary-foreground/55">
        {label}
      </p>
      <p
        className="mt-1 font-display text-lg font-semibold leading-tight"
        style={{
          fontFamily: "var(--stayo-font-display)",
          color: tone ?? "var(--primary-foreground)",
        }}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[10px] text-primary-foreground/55">
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
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-primary-foreground/15 bg-primary-foreground/[0.06] px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/10"
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
  readiness,
  pendingCount,
  onOpenProposal,
  onOpenPortal,
}: {
  implementation: ImplementationProject;
  progressPercent: number;
  progressDone: number;
  progressTotal: number;
  readiness: ReadinessResult;
  pendingCount: number;
  onOpenProposal: () => void;
  onOpenPortal: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const place = [implementation.condominiumName, implementation.unit]
    .filter(Boolean)
    .join(" • ");

  return (
    <section className="rounded-[var(--radius-card)] bg-brand p-5 text-primary-foreground shadow-[var(--shadow-card)] sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-premium">{implementation.code} · {statusLabels[implementation.status]}</p>
          <h1 className="mt-2 truncate font-display text-xl font-semibold leading-tight sm:text-2xl">
            {implementation.nickname || place || "Imóvel ainda sem identificação"}
          </h1>
          {implementation.nickname && place && <p className="mt-1 flex items-center gap-1.5 text-sm text-primary-foreground/70"><MapPin size={13} />{place}</p>}
          <p className="mt-1 text-sm text-primary-foreground/70">
            {implementation.ownerName || "Proprietário não informado"}
          </p>
        </div>

        <div className="hidden flex-wrap justify-end gap-2 sm:flex">
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

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Status" value={statusLabels[implementation.status]} />
        <Metric
          label="Progresso"
          value={`${progressPercent}%`}
          hint={`${progressDone} de ${progressTotal} itens concluídos`}
        />
        <Metric
          label="Prontidão"
          value={readiness.label}
          tone={
            readiness.status === "apta"
              ? "var(--stayo-success)"
              : readiness.status === "bloqueada"
                ? "var(--stayo-danger)"
                : "var(--stayo-gold)"
          }
          hint="Não é o mesmo que progresso"
        />
        <Metric
          label="Pendências"
          value={String(pendingCount)}
          tone={pendingCount > 0 ? "var(--stayo-gold)" : "var(--primary-foreground)"}
          hint="Itens obrigatórios ou bloqueadores em aberto"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 sm:hidden">
        <ActionButton onClick={onOpenPortal} icon={<ExternalLink size={14} />}>Portal</ActionButton>
        <ActionButton onClick={onOpenProposal} icon={<FileText size={14} />}>Documento</ActionButton>
      </div>
    </section>
  );
}
