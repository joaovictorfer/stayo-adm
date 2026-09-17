import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/implantacao/")({
  head: () => ({
    meta: [
      { title: "Implantações — Stayo Admin" },
      { name: "description", content: "Seção Implantações do painel interno Stayo Admin." },
      { property: "og:title", content: "Implantações — Stayo Admin" },
      { property: "og:description", content: "Seção Implantações do painel interno Stayo Admin." },
    ],
  }),
  component: ImplementationsPage,
});

function ImplementationsPage() {
  return <EmptyState title="Implantações" />;
}
