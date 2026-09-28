import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { SettingsDemo } from "@/components/admin/SettingsDemo";

export const Route = createFileRoute("/configuracoes/alertas")({
  head: () => ({ meta: [
    { title: "Alertas — Stayo Admin" },
    { name: "description", content: "Regras que avisam a equipe sobre situações que pedem atenção." },
    { property: "og:title", content: "Alertas — Stayo Admin" },
    { property: "og:description", content: "Regras que avisam a equipe sobre situações que pedem atenção." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <SettingsDemo title="Alertas" description="Regras que avisam a equipe sobre situações que pedem atenção." icon={Bell} rows={[
      { title: "Check-in sem web check-in", detail: "24h antes da chegada", badge: "Regra" },
      { title: "Tarefa atrasada", detail: "Após o horário previsto", badge: "Regra" },
      { title: "Estoque abaixo do mínimo", detail: "Por imóvel", badge: "Regra" },
      { title: "Mensagem sem resposta", detail: "Após 30 minutos", badge: "Regra" },
    ]} />
  ),
});
