import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/condominios")({
  head: () => ({
    meta: [
      { title: "Condomínios — Stayo Admin" },
      { name: "description", content: "Seção Condomínios do painel interno Stayo Admin." },
      { property: "og:title", content: "Condomínios — Stayo Admin" },
      { property: "og:description", content: "Seção Condomínios do painel interno Stayo Admin." },
    ],
  }),
  component: CondominiumsPage,
});

function CondominiumsPage() {
  return <EmptyState title="Condomínios" />;
}
