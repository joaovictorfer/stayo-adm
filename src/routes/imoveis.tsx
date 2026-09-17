import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/imoveis")({
  head: () => ({
    meta: [
      { title: "Imóveis — Stayo Admin" },
      { name: "description", content: "Seção Imóveis do painel interno Stayo Admin." },
      { property: "og:title", content: "Imóveis — Stayo Admin" },
      { property: "og:description", content: "Seção Imóveis do painel interno Stayo Admin." },
    ],
  }),
  component: PropertiesPage,
});

function PropertiesPage() {
  return <EmptyState title="Imóveis" />;
}
