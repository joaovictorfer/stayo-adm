import { createFileRoute } from "@tanstack/react-router";
import { Smartphone } from "lucide-react";

import { SettingsDemo } from "@/components/admin/SettingsDemo";

export const Route = createFileRoute("/configuracoes/portal-staff")({
  head: () => ({ meta: [
    { title: "Portal Staff — Stayo Admin" },
    { name: "description", content: "Acesso da equipe de campo às tarefas do dia." },
    { property: "og:title", content: "Portal Staff — Stayo Admin" },
    { property: "og:description", content: "Acesso da equipe de campo às tarefas do dia." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <SettingsDemo title="Portal Staff" description="Acesso da equipe de campo às tarefas do dia." icon={Smartphone} rows={[
      { title: "Agenda do dia", detail: "Tarefas atribuídas ao colaborador", badge: "Leitura" },
      { title: "Checklist de limpeza", detail: "Por imóvel", badge: "Leitura" },
      { title: "Registro de fotos", detail: "Vistoria e manutenção", badge: "Leitura" },
      { title: "Ocorrências", detail: "Avisos para a central", badge: "Leitura" },
    ]} />
  ),
});
