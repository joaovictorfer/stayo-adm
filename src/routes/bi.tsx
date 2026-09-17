import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/bi")({
  head: () => ({
    meta: [
      { title: "BI — Stayo Admin" },
      { name: "description", content: "Seção BI do painel interno Stayo Admin." },
      { property: "og:title", content: "BI — Stayo Admin" },
      { property: "og:description", content: "Seção BI do painel interno Stayo Admin." },
    ],
  }),
  component: BiPage,
});

function BiPage() {
  return <EmptyState title="BI" />;
}
