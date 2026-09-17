import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/reservas")({
  head: () => ({
    meta: [
      { title: "Reservas — Stayo Admin" },
      { name: "description", content: "Seção Reservas do painel interno Stayo Admin." },
      { property: "og:title", content: "Reservas — Stayo Admin" },
      { property: "og:description", content: "Seção Reservas do painel interno Stayo Admin." },
    ],
  }),
  component: ReservationsPage,
});

function ReservationsPage() {
  return <EmptyState title="Reservas" />;
}
