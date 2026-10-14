import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { Button } from "../../ui/button";
import { ownerOnboardingLinkQuery, ownerOnboardingSubmissionQuery } from "../../../lib/api/queries";
import { proposalStage, type ProposalStage } from "../../../lib/journey-states";
import { ownerOnboardingLinkStatus } from "../../../types/owner-onboarding";
import type { CommercialProposalStatus } from "../../../types/commercial-proposal";

const PROPOSAL: Record<ProposalStage, string> = { nenhuma: "Não criada", rascunho: "Rascunho", publicada: "Publicada", aceita: "Aceita" };

/**
 * Três etapas distintas, cada uma com seu próprio link/permissão:
 * Proposta (link somente leitura), Cadastro (jornada para contrato) e Portal (conta).
 * Só leitura: não gera, envia nem revoga links.
 */
export function useOwnerJourneyStatus(implementationId: string, versions: Array<{ status: CommercialProposalStatus }>) {
  const linkQ = useQuery(ownerOnboardingLinkQuery(implementationId));
  const subQ = useQuery(ownerOnboardingSubmissionQuery(implementationId));
  const stage = proposalStage(versions);
  const link = linkQ.data ?? null;
  const ls = link ? ownerOnboardingLinkStatus(link) : null;
  const sub = subQ.data ?? null;
  const loading = linkQ.isPending || subQ.isPending;
  const cadastro = loading
    ? "—"
    : sub?.submittedAt
      ? "Recebido"
      : sub
        ? "Em andamento"
        : stage === "publicada" || stage === "aceita"
          ? "Aguardando"
          : "Não liberado";
  const portal = loading
    ? "—"
    : !link
      ? "Não criado"
      : ls === "usado"
        ? "Conta criada"
        : ls === "revogado"
          ? "Link revogado"
          : ls === "expirado"
            ? "Link expirado"
            : link.lastAccessAt
              ? "Acessado"
              : "Link de acesso gerado";
  return { proposta: PROPOSAL[stage], cadastro, portal };
}

export function OwnerJourneyStatus({
  implementationId,
  versions,
  onOpenPortal,
}: {
  implementationId: string;
  versions: Array<{ status: CommercialProposalStatus }>;
  onOpenPortal?: () => void;
}) {
  const s = useOwnerJourneyStatus(implementationId, versions);
  const tone = (v: string) =>
    ["Publicada", "Aceita", "Recebido", "Conta criada", "Acessado", "Link de acesso gerado"].includes(v)
      ? { bg: "color-mix(in oklab, var(--stayo-success) 14%, white)", fg: "var(--stayo-success)" }
      : ["Link expirado", "Link revogado"].includes(v)
        ? { bg: "color-mix(in oklab, #c2410c 12%, white)", fg: "#c2410c" }
        : ["Aguardando", "Em andamento", "Rascunho"].includes(v)
          ? { bg: "color-mix(in oklab, #b7791f 14%, white)", fg: "#8a5a12" }
          : { bg: "var(--stayo-surface, #f4f4f2)", fg: "var(--stayo-ink-muted)" };
  const rows = [
    { label: "Proposta", hint: "Link de leitura", value: s.proposta },
    { label: "Cadastro", hint: "Dados do contrato", value: s.cadastro },
    { label: "Portal", hint: "Conta do proprietário", value: s.portal },
  ];
  return (
    <section className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: "var(--stayo-border)" }} aria-label="Jornada do proprietário">
      <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>Jornada do proprietário</h3>
      <ol className="mt-3 grid gap-2 sm:grid-cols-3">
        {rows.map((r, i) => {
          const t = tone(r.value);
          return (
            <li key={r.label} className="flex min-w-0 items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--stayo-border)" }}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold" style={{ background: t.bg, color: t.fg }}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" style={{ color: "var(--stayo-navy)" }}>{r.label}</p>
                <p className="truncate text-xs" style={{ color: "var(--stayo-ink-muted)" }}>{r.hint}</p>
              </div>
              <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: t.bg, color: t.fg }}>{r.value}</span>
            </li>
          );
        })}
      </ol>
      {onOpenPortal && (
        <Button variant="link" size="sm" className="mt-1 px-0" onClick={onOpenPortal}>
          Gerenciar na aba Portal <ChevronRight />
        </Button>
      )}
    </section>
  );
}
