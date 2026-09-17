import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/configuracoes/")({
  head: () => ({
    meta: [
      { title: "Configurações — Stayo Admin" },
      { name: "description", content: "Seção Configurações do painel interno Stayo Admin." },
      { property: "og:title", content: "Configurações — Stayo Admin" },
      { property: "og:description", content: "Seção Configurações do painel interno Stayo Admin." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return <EmptyState title="Configurações" />;
}
