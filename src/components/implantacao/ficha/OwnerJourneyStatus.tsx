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
  const rows = [
    { label: "Proposta", value: s.proposta },
    { label: "Cadastro", value: s.cadastro },
    { label: "Portal", value: s.portal },
  ];
  return (
    <section className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--stayo-border)" }} aria-label="Jornada do proprietário">
      <h3 className="text-base font-semibold" style={{ color: "var(--stayo-navy)" }}>Jornada do proprietário</h3>
      <dl className="mt-2 divide-y" style={{ borderColor: "var(--stayo-border)" }}>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 py-2 text-sm">
            <dt style={{ color: "var(--stayo-navy)" }}>{r.label}</dt>
            <dd style={{ color: "var(--stayo-ink-muted)" }}>{r.value}</dd>
          </div>
        ))}
      </dl>
      {onOpenPortal && (
        <Button variant="link" size="sm" className="px-0" onClick={onOpenPortal}>
          Gerenciar na aba Portal <ChevronRight />
        </Button>
      )}
    </section>
  );
}
