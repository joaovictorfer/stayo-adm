import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/implantacao/templates")({
  head: () => ({
    meta: [
      { title: "Templates — Stayo Admin" },
      { name: "description", content: "Seção Templates do painel interno Stayo Admin." },
      { property: "og:title", content: "Templates — Stayo Admin" },
      { property: "og:description", content: "Seção Templates do painel interno Stayo Admin." },
    ],
  }),
  component: ImplementationTemplatesPage,
});

function ImplementationTemplatesPage() {
  return <EmptyState title="Templates" />;
}
