import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { SettingsDemo } from "@/components/admin/SettingsDemo";

export const Route = createFileRoute("/configuracoes/equipe")({
  head: () => ({ meta: [
    { title: "Equipe — Stayo Admin" },
    { name: "description", content: "Usuários internos, papéis e escopos de acesso." },
    { property: "og:title", content: "Equipe — Stayo Admin" },
    { property: "og:description", content: "Usuários internos, papéis e escopos de acesso." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <SettingsDemo title="Equipe" description="Usuários internos, papéis e escopos de acesso." icon={Users} rows={[
      { title: "Administração", detail: "Acesso total ao Admin", badge: "Papel" },
      { title: "Operação", detail: "Tarefas, agenda, vistorias", badge: "Papel" },
      { title: "Comercial", detail: "Implantações e propostas", badge: "Papel" },
      { title: "Financeiro", detail: "Repasses e faturas", badge: "Papel" },
    ]} />
  ),
});
