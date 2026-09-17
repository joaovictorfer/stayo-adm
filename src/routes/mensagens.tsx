import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/mensagens")({
  head: () => ({
    meta: [
      { title: "Mensagens — Stayo Admin" },
      { name: "description", content: "Seção Mensagens do painel interno Stayo Admin." },
      { property: "og:title", content: "Mensagens — Stayo Admin" },
      { property: "og:description", content: "Seção Mensagens do painel interno Stayo Admin." },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  return <EmptyState title="Mensagens" />;
}
