import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Stayo Admin" },
      { name: "description", content: "Seção Dashboard do painel interno Stayo Admin." },
      { property: "og:title", content: "Dashboard — Stayo Admin" },
      { property: "og:description", content: "Seção Dashboard do painel interno Stayo Admin." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return <EmptyState title="Dashboard" />;
}
