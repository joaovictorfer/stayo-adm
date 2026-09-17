import { createFileRoute } from "@tanstack/react-router";

import { EmptyState } from "../components/EmptyState";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos / Serviços — Stayo Admin" },
      { name: "description", content: "Seção Produtos / Serviços do painel interno Stayo Admin." },
      { property: "og:title", content: "Produtos / Serviços — Stayo Admin" },
      { property: "og:description", content: "Seção Produtos / Serviços do painel interno Stayo Admin." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  return <EmptyState title="Produtos / Serviços" />;
}
