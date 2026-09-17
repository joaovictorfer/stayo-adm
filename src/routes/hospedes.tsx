import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/hospedes")({
  head: () => ({
    meta: [
      { title: "Hóspedes — Stayo Admin" },
      { name: "description", content: "Seção Hóspedes do painel interno Stayo Admin." },
      { property: "og:title", content: "Hóspedes — Stayo Admin" },
      { property: "og:description", content: "Seção Hóspedes do painel interno Stayo Admin." },
    ],
  }),
  component: GuestsPage,
});

function GuestsPage() {
  return <EmptyState title="Hóspedes" />;
}
