import { Link, createFileRoute } from "@tanstack/react-router";
import { ClipboardList, DatabaseZap, HandCoins, Plug, Server } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { PageHeader } from "../components/data/ListStates";

/** `to` vem de dados de configuração, então usamos o Link com tipagem solta. */
const DynamicLink = Link as unknown as ComponentType<{
  to: string;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
}>;

export const Route = createFileRoute("/configuracoes/")({
  head: () => ({
    meta: [
      { title: "Configurações — Stayo Admin" },
      { name: "description", content: "Seção Configurações do painel interno Stayo Admin." },
      { property: "og:title", content: "Configurações — Stayo Admin" },
      { property: "og:description", content: "Seção Configurações do painel interno Stayo Admin." },
    ],
  }),
  component: SettingsPage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

interface SettingsLink {
  icon: ComponentType<{ size?: number; className?: string }>;
  to: string;
  title: string;
  description: string;
}

const links: SettingsLink[] = [
  {
    icon: Server,
    to: "/configuracoes/stayo-core",
    title: "Stayo Core",
    description: "Status da API, aplicativos, scopes, webhooks e logs.",
  },
  {
    icon: Plug,
    to: "/configuracoes/integracoes",
    title: "Integrações",
    description:
      "Referência das integrações externas do STAYO.APP (Ayrton, Condfy, WhatsApp, Web Check-in).",
  },
  {
    icon: ClipboardList,
    to: "/configuracoes/auditoria",
    title: "Auditoria",
    description: "Histórico de ações sensíveis: implantações, propostas, convites, cobranças.",
  },
  {
    icon: HandCoins,
    to: "/configuracoes/comercial",
    title: "Condições comerciais",
    description:
      "Taxas e valores padrão (administração, limpeza, implantação) para novas propostas.",
  },
  {
    icon: ClipboardList,
    to: "/configuracoes/guias",
    title: "Catálogo de guias",
    description: "Recomendações reutilizáveis do Guia de Utensílios aplicadas às implantações.",
  },
  {
    icon: ClipboardList,
    to: "/configuracoes/vistorias-prototipo",
    title: "Vistorias (protótipo)",
    description: "Modelos, ambientes e itens de vistoria — protótipo visual, sem persistência.",
  },
  {
    icon: DatabaseZap,
    to: "/configuracoes/migracao",
    title: "Migração de dados",
    description: "Mapa de todo dado hoje em localStorage e o status da migração para o Supabase.",
  },
];

function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <DynamicLink
            key={l.to}
            to={l.to}
            className="flex items-start gap-3 rounded-[var(--radius-card)] border p-4"
            style={{ ...surface, color: "var(--stayo-ink)" }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-forest)" }}
            >
              <l.icon size={18} />
            </span>
            <div>
              <p style={{ fontFamily: "var(--stayo-font-display)" }}>{l.title}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                {l.description}
              </p>
            </div>
          </DynamicLink>
        ))}
      </div>
    </>
  );
}
