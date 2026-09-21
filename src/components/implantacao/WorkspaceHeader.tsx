/**
 * Cabeçalho contextual do workspace de implantação (Fase B do plano).
 *
 * Responde de relance: onde estamos, quanto já foi feito, se está apta e
 * quantas pendências existem. Progresso e prontidão NUNCA se fundem numa
 * barra só — são conceitos distintos (ver implementation-status.ts).
 */

import { Check, Copy, FileDown, ExternalLink, ImagePlus, MapPin } from "lucide-react";
import { useRef, useState } from "react";

import { statusLabels, type ReadinessResult } from "../../lib/implementation-status";
import type { ImplementationProject } from "../../types/core";
import { ImplementationCoverImage } from "./ImplementationCoverImage";

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneColor = {
    neutral: "var(--foreground)",
    success: "var(--stayo-success)",
    warning: "var(--stayo-warning)",
    danger: "var(--destructive)",
  }[tone ?? "neutral"];

  return (
    <div className="min-h-28 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-xl font-semibold leading-tight" style={{ color: toneColor }}>
        {value}
      </p>
      {hint && (
        <p className="mt-2 text-xs leading-4 text-muted-foreground">
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
      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-primary-foreground/20 bg-primary-foreground/[0.08] px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/15"
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
  onGenerateSummary,
  onOpenPortal,
  onCoverSelected,
  coverUploadAvailable,
  coverUploading,
}: {
  implementation: ImplementationProject;
  progressPercent: number;
  progressDone: number;
  progressTotal: number;
  readiness: ReadinessResult;
  pendingCount: number;
  onGenerateSummary: () => void;
  onOpenPortal: () => void;
  onCoverSelected: (file: File) => void;
  coverUploadAvailable: boolean;
  coverUploading: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const place = [implementation.condominiumName, implementation.unit]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="space-y-3">
      <section className="relative isolate min-h-64 overflow-hidden rounded-[var(--radius-card)] bg-brand text-primary-foreground shadow-[var(--shadow-card)] sm:min-h-72">
      <ImplementationCoverImage implementation={implementation} eager className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--admin-navy-dark)_94%,transparent)_0%,color-mix(in_oklab,var(--admin-navy)_78%,transparent)_48%,color-mix(in_oklab,var(--admin-navy)_28%,transparent)_100%)]" />
      <div className="relative flex min-h-64 flex-col justify-between gap-8 px-4 py-4 sm:min-h-72 sm:px-5 sm:py-5">
      <div className="flex justify-end">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onCoverSelected(file);
            event.target.value = "";
          }}
        />
        <ActionButton
          onClick={() => fileInputRef.current?.click()}
          icon={<ImagePlus size={14} />}
        >
          {coverUploading ? "Enviando..." : implementation.coverImage ? "Trocar capa" : "Adicionar capa"}
        </ActionButton>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase text-premium">{implementation.code}</p>
            <span className="rounded-full border border-primary-foreground/15 bg-primary-foreground/10 px-2 py-0.5 text-[11px] font-semibold">
              {statusLabels[implementation.status]}
            </span>
          </div>
          <h1 className="mt-1.5 font-display text-xl font-semibold leading-tight sm:text-2xl">
            {implementation.nickname || place || "Imóvel ainda sem identificação"}
          </h1>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-primary-foreground/70">
            {implementation.nickname && place && <p className="flex items-center gap-1.5"><MapPin size={13} />{place}</p>}
            <p>Proprietário: <span className="font-medium text-primary-foreground">{implementation.ownerName || "Não informado"}</span></p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
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
          <ActionButton onClick={onGenerateSummary} icon={<FileDown size={14} />}>
            Gerar resumo
          </ActionButton>
        </div>
      </div>
      {!coverUploadAvailable && (
        <p className="text-right text-[11px] text-primary-foreground/65">A troca de capa estará disponível com o armazenamento conectado.</p>
      )}
      </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Etapa atual" value={statusLabels[implementation.status]} />
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
              ? "success"
              : readiness.status === "bloqueada"
                ? "danger"
                : "warning"
          }
          hint={`${readiness.pendingBlockers} bloqueador(es) · ${readiness.pendingMandatory} obrigatório(s)`}
        />
        <Metric
          label="Pendências"
          value={String(pendingCount)}
          tone={pendingCount > 0 ? "warning" : "success"}
          hint={pendingCount > 0 ? "Requerem acompanhamento" : "Nenhuma pendência crítica"}
        />
      </div>
    </div>
  );
}
