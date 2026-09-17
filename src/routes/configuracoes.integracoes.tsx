import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/configuracoes/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — Stayo Admin" },
      { name: "description", content: "Seção Integrações do painel interno Stayo Admin." },
      { property: "og:title", content: "Integrações — Stayo Admin" },
      { property: "og:description", content: "Seção Integrações do painel interno Stayo Admin." },
    ],
  }),
  component: SettingsIntegrationsPage,
});

function SettingsIntegrationsPage() {
  return <EmptyState title="Integrações" />;
}
