import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { proposalsStore } from "../lib/api/local-store";
import {
  adminApi,
  commercialTermsQuery,
  implementationQuery,
  proposalByIdQuery,
  proposalShareLinkByTokenQuery,
} from "../lib/api/queries";
import { generateProposalPdf } from "../lib/pdf/proposal-pdf";

export const Route = createFileRoute("/portal/proposta/$token")({
  head: () => ({
    meta: [
      { title: "Proposta — Stayo" },
      { name: "description", content: "Proposta comercial da implantação do seu imóvel." },
    ],
  }),
  component: ProposalPortalPage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-start justify-center px-4 py-10 sm:items-center"
      style={{
        backgroundColor: "var(--stayo-bg)",
        color: "var(--stayo-ink)",
        fontFamily: "var(--stayo-font-ui)",
      }}
    >
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-sm"
            style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
          >
            S
          </span>
          <span className="text-base" style={{ fontFamily: "var(--stayo-font-display)" }}>
            Stayo
          </span>
        </div>
        <div className="rounded-[var(--radius-card)] border p-6" style={surface}>
          {children}
        </div>
      </div>
    </div>
  );
}

function ProposalPortalPage() {
  const { token } = Route.useParams();
  const linkQuery = useQuery(proposalShareLinkByTokenQuery(token));

  if (linkQuery.isPending) {
    return (
      <Shell>
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Carregando...
        </p>
      </Shell>
    );
  }

  if (!linkQuery.data) {
    return (
      <Shell>
        <h1 className="text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
          Link inválido
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Este link de proposta não existe ou expirou. Fale com quem enviou o link para receber um
          novo.
        </p>
      </Shell>
    );
  }

  return (
    <ProposalView
      implementationId={linkQuery.data.implementationId}
      proposalId={linkQuery.data.proposalId}
    />
  );
}

function ProposalView({
  implementationId,
  proposalId,
}: {
  implementationId: string;
  proposalId: string;
}) {
  const queryClient = useQueryClient();
  const implementationQ = useQuery(implementationQuery(implementationId));
  // Sempre ESTA versão específica — nunca "a mais recente da implantação".
  const proposalQ = useQuery(proposalByIdQuery(proposalId));
  const commercialTermsQ = useQuery(commercialTermsQuery(implementationId));
  const proposal = proposalQ.data;
  const [acceptedName, setAcceptedName] = useState("");
  const [agreed, setAgreed] = useState(false);

  const downloadPdf = useMutation({
    mutationFn: async () => {
      if (!proposal || !implementationQ.data) throw new Error("Proposta ausente");
      const bytes = await generateProposalPdf({
        implementation: implementationQ.data,
        proposal,
        recurringTerms: (commercialTermsQ.data ?? []).filter((t) => t.chargeType !== "fixed_once"),
        portalUrl: typeof window !== "undefined" ? window.location.href : null,
      });
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposta-${implementationQ.data.code}-v${proposal.version}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const accept = useMutation({
    mutationFn: async () => {
      const accepted = await proposalsStore.accept(proposalId, acceptedName.trim());
      await adminApi.audit.log({
        actorId: null,
        event: "proposal.accepted",
        entityType: "proposal",
        entityId: proposalId,
        metadata: {
          implementationId,
          version: proposal?.version,
          acceptedName: acceptedName.trim(),
        },
      });
      return accepted;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });

  if (proposalQ.isPending || implementationQ.isPending) {
    return (
      <Shell>
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Carregando...
        </p>
      </Shell>
    );
  }

  if (!proposal) {
    return (
      <Shell>
        <h1 className="text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
          Nenhuma proposta disponível
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Ainda não há uma proposta salva para compartilhar.
        </p>
      </Shell>
    );
  }

  const canAccept = acceptedName.trim() !== "" && agreed;

  return (
    <Shell>
      <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        {implementationQ.data?.code} · Versão {proposal.version}
      </p>
      <h1 className="mt-1 text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
        Proposta comercial
      </h1>

      <ul
        className="mt-4 divide-y rounded-[var(--radius-card)] border"
        style={{ borderColor: "var(--stayo-border)" }}
      >
        {proposal.items.map((item, i) => (
          <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>
              {item.description}{" "}
              <span style={{ color: "var(--stayo-ink-muted)" }}>x{item.quantity}</span>
            </span>
            <span>{currency.format(item.total)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-medium">Total</span>
        <span
          className="text-xl"
          style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
        >
          {currency.format(proposal.total)}
        </span>
      </div>

      <button
        type="button"
        onClick={() => downloadPdf.mutate()}
        disabled={downloadPdf.isPending}
        className="mt-3 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm disabled:opacity-60"
        style={{ ...surface, color: "var(--stayo-forest)" }}
      >
        {downloadPdf.isPending ? "Gerando PDF..." : "Baixar PDF desta proposta"}
      </button>

      <div className="mt-6">
        {proposal.acceptedAt ? (
          <p className="text-sm" style={{ color: "var(--stayo-success)" }}>
            Proposta aceita{proposal.acceptedName ? ` por ${proposal.acceptedName}` : ""} em{" "}
            {new Date(proposal.acceptedAt).toLocaleString("pt-BR")}.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Seu nome completo
              <input
                value={acceptedName}
                onChange={(e) => setAcceptedName(e.target.value)}
                className="rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
              />
            </label>
            <label
              className="flex items-start gap-2 text-xs"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5"
              />
              Li e concordo com a proposta apresentada.
            </label>
            <button
              type="button"
              onClick={() => accept.mutate()}
              disabled={accept.isPending || !canAccept}
              className="w-full rounded-[var(--radius-control)] px-4 py-2.5 text-sm disabled:opacity-60"
              style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
            >
              {accept.isPending ? "Enviando..." : "Aceitar proposta"}
            </button>
            <p className="text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>
              Este aceite registra sua concordância comercial com esta proposta — não substitui a
              assinatura do contrato de prestação de serviço.
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}
