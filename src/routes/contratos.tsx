import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/contratos")({
  head: () => ({
    meta: [
      { title: "Contratos — Stayo Admin" },
      { name: "description", content: "Seção Contratos do painel interno Stayo Admin." },
      { property: "og:title", content: "Contratos — Stayo Admin" },
      { property: "og:description", content: "Seção Contratos do painel interno Stayo Admin." },
    ],
  }),
  component: ContractsPage,
});

function ContractsPage() {
  return <EmptyState title="Contratos" />;
}
