import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Stayo Admin" },
      { name: "description", content: "Seção Financeiro do painel interno Stayo Admin." },
      { property: "og:title", content: "Financeiro — Stayo Admin" },
      { property: "og:description", content: "Seção Financeiro do painel interno Stayo Admin." },
    ],
  }),
  component: FinancialPage,
});

function FinancialPage() {
  return <EmptyState title="Financeiro" />;
}
