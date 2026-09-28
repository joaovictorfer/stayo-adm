import { createFileRoute } from "@tanstack/react-router";

import { TaskBoard } from "@/components/admin/TaskBoard";

export const Route = createFileRoute("/operacao/tarefas")({
  head: () => ({ meta: [
    { title: "Tarefas — Stayo Admin" },
    { name: "description", content: "Tarefas operacionais por imóvel, em leitura segura." },
    { property: "og:title", content: "Tarefas — Stayo Admin" },
    { property: "og:description", content: "Tarefas operacionais por imóvel, em leitura segura." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <TaskBoard mode="tarefas" />,
});
