import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Building2, Smartphone, ClipboardCheck } from "lucide-react";
import type { ComponentType } from "react";

import { PageHeader } from "../components/data/ListStates";

export const Route = createFileRoute("/configuracoes/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — Stayo Admin" },
      {
        name: "description",
        content: "Referência das integrações externas do ecossistema Stayo.",
      },
      { property: "og:title", content: "Integrações — Stayo Admin" },
      {
        property: "og:description",
        content: "Referência das integrações externas do ecossistema Stayo.",
      },
    ],
  }),
  component: SettingsIntegrationsPage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

interface IntegrationInfo {
  icon: ComponentType<{ size?: number; className?: string }>;
  name: string;
  description: string;
}

const integrations: IntegrationInfo[] = [
  {
    icon: Building2,
    name: "Ayrton",
    description: "Channel manager — sincroniza calendário e reservas com os canais de venda.",
  },
  {
    icon: ClipboardCheck,
    name: "Condfy",
    description: "Integração com a portaria/administração dos condomínios.",
  },
  {
    icon: MessageCircle,
    name: "WhatsApp",
    description: "Canal de mensagens com hóspedes e proprietários.",
  },
  {
    icon: Smartphone,
    name: "Web Check-in",
    description: "Formulário de check-in antecipado preenchido pelo hóspede.",
  },
];

function SettingsIntegrationsPage() {
  return (
    <>
      <PageHeader title="Integrações" />
      <div
        className="mb-4 rounded-[var(--radius-card)] border p-4 text-sm"
        style={{
          backgroundColor: "var(--stayo-gold-soft)",
          borderColor: "var(--stayo-border)",
          color: "var(--stayo-ink)",
        }}
      >
        Estas integrações pertencem ao STAYO.APP — o Stayo Admin é um sistema apartado e nunca se
        conecta a elas diretamente. Esta tela é só uma referência de contexto; status ao vivo só
        chegará aqui quando o Stayo Core expuser esse dado.
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {integrations.map((i) => (
          <div
            key={i.name}
            className="flex items-start gap-3 rounded-[var(--radius-card)] border p-4"
            style={surface}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-forest)" }}
            >
              <i.icon size={18} />
            </span>
            <div>
              <p style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}>
                {i.name}
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                {i.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
