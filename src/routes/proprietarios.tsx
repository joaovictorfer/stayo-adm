import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/proprietarios")({
  head: () => ({
    meta: [
      { title: "Proprietários — Stayo Admin" },
      { name: "description", content: "Seção Proprietários do painel interno Stayo Admin." },
      { property: "og:title", content: "Proprietários — Stayo Admin" },
      { property: "og:description", content: "Seção Proprietários do painel interno Stayo Admin." },
    ],
  }),
  component: OwnersPage,
});

function OwnersPage() {
  return <EmptyState title="Proprietários" />;
}
