import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { proposalsStore } from "../lib/api/local-store";
import {
  implementationQuery,
  proposalShareLinkByTokenQuery,
  proposalsByImplementationQuery,
} from "../lib/api/queries";

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

  return <ProposalView implementationId={linkQuery.data.implementationId} />;
}

function ProposalView({ implementationId }: { implementationId: string }) {
  const queryClient = useQueryClient();
  const implementationQ = useQuery(implementationQuery(implementationId));
  const proposalsQ = useQuery(proposalsByImplementationQuery(implementationId));
  const latest = proposalsQ.data?.[0];

  const accept = useMutation({
    mutationFn: () => proposalsStore.accept(latest!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });

  if (proposalsQ.isPending || implementationQ.isPending) {
    return (
      <Shell>
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Carregando...
        </p>
      </Shell>
    );
  }

  if (!latest) {
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

  return (
    <Shell>
      <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        {implementationQ.data?.code} · Versão {latest.version}
      </p>
      <h1 className="mt-1 text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
        Proposta comercial
      </h1>

      <ul
        className="mt-4 divide-y rounded-[var(--radius-card)] border"
        style={{ borderColor: "var(--stayo-border)" }}
      >
        {latest.items.map((item, i) => (
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
          {currency.format(latest.total)}
        </span>
      </div>

      <div className="mt-6">
        {latest.acceptedAt ? (
          <p className="text-sm" style={{ color: "var(--stayo-success)" }}>
            Proposta aceita em {new Date(latest.acceptedAt).toLocaleString("pt-BR")}.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => accept.mutate()}
            disabled={accept.isPending}
            className="w-full rounded-[var(--radius-control)] px-4 py-2.5 text-sm disabled:opacity-60"
            style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
          >
            {accept.isPending ? "Enviando..." : "Aceitar proposta"}
          </button>
        )}
      </div>
    </Shell>
  );
}
