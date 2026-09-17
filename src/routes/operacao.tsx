import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/operacao")({
  head: () => ({
    meta: [
      { title: "Operação — Stayo Admin" },
      { name: "description", content: "Seção Operação do painel interno Stayo Admin." },
      { property: "og:title", content: "Operação — Stayo Admin" },
      { property: "og:description", content: "Seção Operação do painel interno Stayo Admin." },
    ],
  }),
  component: OperationsPage,
});

function OperationsPage() {
  return <EmptyState title="Operação" />;
}
