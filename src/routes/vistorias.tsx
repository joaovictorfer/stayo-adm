import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/vistorias")({
  head: () => ({
    meta: [
      { title: "Vistorias — Stayo Admin" },
      { name: "description", content: "Seção Vistorias do painel interno Stayo Admin." },
      { property: "og:title", content: "Vistorias — Stayo Admin" },
      { property: "og:description", content: "Seção Vistorias do painel interno Stayo Admin." },
    ],
  }),
  component: InspectionsPage,
});

function InspectionsPage() {
  return <EmptyState title="Vistorias" />;
}
