import { createFileRoute } from "@tanstack/react-router";
import { Zap } from "lucide-react";

import { SettingsDemo } from "@/components/admin/SettingsDemo";

export const Route = createFileRoute("/configuracoes/automacoes")({
  head: () => ({ meta: [
    { title: "Automações — Stayo Admin" },
    { name: "description", content: "Mensagens e rotinas disparadas pelo STAYO APP." },
    { property: "og:title", content: "Automações — Stayo Admin" },
    { property: "og:description", content: "Mensagens e rotinas disparadas pelo STAYO APP." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <SettingsDemo title="Automações" description="Mensagens e rotinas disparadas pelo STAYO APP." icon={Zap} rows={[
      { title: "Boas-vindas", detail: "Na confirmação da reserva", badge: "Core" },
      { title: "Lembrete de web check-in", detail: "3 dias antes", badge: "Core" },
      { title: "Instruções de chegada", detail: "No dia da entrada", badge: "Core" },
      { title: "Pedido de avaliação", detail: "Após a saída", badge: "Core" },
    ]} />
  ),
});
