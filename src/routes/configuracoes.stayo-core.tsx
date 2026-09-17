import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/configuracoes/stayo-core")({
  head: () => ({
    meta: [
      { title: "Stayo Core — Stayo Admin" },
      { name: "description", content: "Seção Stayo Core do painel interno Stayo Admin." },
      { property: "og:title", content: "Stayo Core — Stayo Admin" },
      { property: "og:description", content: "Seção Stayo Core do painel interno Stayo Admin." },
    ],
  }),
  component: SettingsCorePage,
});

function SettingsCorePage() {
  return <EmptyState title="Stayo Core" />;
}
