import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/implantacao/propostas")({
  head: () => ({
    meta: [
      { title: "Propostas — Stayo Admin" },
      { name: "description", content: "Seção Propostas do painel interno Stayo Admin." },
      { property: "og:title", content: "Propostas — Stayo Admin" },
      { property: "og:description", content: "Seção Propostas do painel interno Stayo Admin." },
    ],
  }),
  component: ProposalsPage,
});

function ProposalsPage() {
  return <EmptyState title="Propostas" />;
}
