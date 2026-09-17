import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/guia")({
  head: () => ({
    meta: [
      { title: "Guia / Conteúdo — Stayo Admin" },
      { name: "description", content: "Seção Guia / Conteúdo do painel interno Stayo Admin." },
      { property: "og:title", content: "Guia / Conteúdo — Stayo Admin" },
      { property: "og:description", content: "Seção Guia / Conteúdo do painel interno Stayo Admin." },
    ],
  }),
  component: GuidePage,
});

function GuidePage() {
  return <EmptyState title="Guia / Conteúdo" />;
}
