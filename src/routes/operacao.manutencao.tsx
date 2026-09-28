import { createFileRoute } from "@tanstack/react-router";

import { TaskBoard } from "@/components/admin/TaskBoard";

export const Route = createFileRoute("/operacao/manutencao")({
  head: () => ({ meta: [
    { title: "Manutenção — Stayo Admin" },
    { name: "description", content: "Chamados e reparos dos imóveis Stayo, em leitura segura." },
    { property: "og:title", content: "Manutenção — Stayo Admin" },
    { property: "og:description", content: "Chamados e reparos dos imóveis Stayo, em leitura segura." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <TaskBoard mode="manutencao" />,
});
