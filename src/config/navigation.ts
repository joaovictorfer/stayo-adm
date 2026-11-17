/**
 * Mapa de navegação do Stayo Admin.
 *
 * `roles` é só o placeholder de RBAC (handoff seção 42) — a permissão
 * REAL sempre vive no backend/RLS do Core, nunca só aqui. Esconder um
 * item de menu não é controle de acesso.
 */

export type StayoRole =
  "super_admin" | "admin" | "operations" | "commercial" | "finance" | "viewer";

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string; // nome do ícone Tabler, ex: "home", "building"
  roles: StayoRole[];
  children?: NavItem[];
}

export interface NavGroup {
  id: string;
  label: string;
  itemIds: string[];
}

export const navigation: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/",
    icon: "layout-dashboard",
    roles: ["super_admin", "admin", "operations", "commercial", "finance", "viewer"],
  },
  {
    id: "properties",
    label: "Imóveis",
    path: "/imoveis",
    icon: "building",
    roles: ["super_admin", "admin", "operations", "viewer"],
  },
  {
    id: "condominiums",
    label: "Condomínios",
    path: "/condominios",
    icon: "building-community",
    roles: ["super_admin", "admin", "operations", "viewer"],
  },
  {
    id: "reservations",
    label: "Reservas",
    path: "/reservas",
    icon: "calendar",
    roles: ["super_admin", "admin", "operations", "viewer"],
  },
  {
    id: "guests",
    label: "Hóspedes",
    path: "/hospedes",
    icon: "users",
    roles: ["super_admin", "admin", "operations"],
  },
  {
    id: "implementation",
    label: "Apartamentos",
    path: "/implantacao",
    icon: "clipboard-list",
    roles: ["super_admin", "admin", "operations", "commercial"],
    children: [
      {
        id: "implementation-list",
        label: "Operação e implantação",
        path: "/implantacao",
        icon: "list",
        roles: ["super_admin", "admin", "operations", "commercial"],
      },
      {
        id: "implementation-templates",
        label: "Templates",
        path: "/implantacao/templates",
        icon: "template",
        roles: ["super_admin", "admin"],
      },
      {
        id: "implementation-proposals",
        label: "Propostas",
        path: "/implantacao/propostas",
        icon: "file-invoice",
        roles: ["super_admin", "admin", "commercial"],
      },
      { id: "implementation-inventory", label: "Inventário e estoque", path: "/implantacao/inventario", icon: "box", roles: ["super_admin", "admin", "operations", "commercial"] },
      { id: "implementation-suppliers", label: "Fornecedores", path: "/implantacao/fornecedores", icon: "truck", roles: ["super_admin", "admin", "operations", "commercial"] },
    ],
  },
  {
    id: "inspections",
    label: "Vistorias",
    path: "/vistorias",
    icon: "checklist",
    roles: ["super_admin", "admin", "operations"],
  },
  {
    id: "operations",
    label: "Operação",
    path: "/operacao",
    icon: "settings-automation",
    roles: ["super_admin", "admin", "operations"],
    children: [
      { id: "operations-overview", label: "Central operacional", path: "/operacao", icon: "list", roles: ["super_admin", "admin", "operations"] },
      { id: "operations-agenda", label: "Agenda", path: "/operacao/agenda", icon: "calendar", roles: ["super_admin", "admin", "operations"] },
      { id: "operations-tasks", label: "Tarefas", path: "/operacao/tarefas", icon: "checklist", roles: ["super_admin", "admin", "operations"] },
      { id: "operations-rules", label: "Regras e checklists", path: "/operacao/regras", icon: "checklist", roles: ["super_admin", "admin", "operations"] },
      { id: "operations-team", label: "Equipe e Meu Dia", path: "/operacao/equipe", icon: "users", roles: ["super_admin", "admin", "operations"] },
      { id: "operations-maintenance", label: "Manutenção", path: "/operacao/manutencao", icon: "tool", roles: ["super_admin", "admin", "operations"] },
      { id: "operations-inspections", label: "Vistorias", path: "/vistorias", icon: "checklist", roles: ["super_admin", "admin", "operations"] },
    ],
  },
  {
    id: "providers",
    label: "Prestadores",
    path: "/prestadores",
    icon: "user-check",
    roles: ["super_admin", "admin", "operations", "finance"],
  },
  {
    id: "messages",
    label: "Mensagens",
    path: "/mensagens",
    icon: "message-circle",
    roles: ["super_admin", "admin", "operations"],
  },
  {
    id: "owners",
    label: "Proprietários",
    path: "/proprietarios",
    icon: "user-star",
    roles: ["super_admin", "admin", "commercial"],
    children: [
      { id: "owners-list", label: "Proprietários", path: "/proprietarios", icon: "users", roles: ["super_admin", "admin", "commercial"] },
      { id: "owners-submissions", label: "Cadastros enviados", path: "/proprietarios/cadastros", icon: "file-text", roles: ["super_admin", "admin", "commercial"] },
    ],
  },
  {
    id: "contracts",
    label: "Contratos",
    path: "/contratos",
    icon: "file-text",
    roles: ["super_admin", "admin", "commercial"],
  },
  {
    id: "products",
    label: "Produtos / Serviços",
    path: "/produtos",
    icon: "shopping-bag",
    roles: ["super_admin", "admin", "commercial"],
  },
  {
    id: "financial",
    label: "Financeiro",
    path: "/financeiro",
    icon: "currency-dollar",
    roles: ["super_admin", "finance"],
    children: [
      { id: "financial-overview", label: "Visão geral", path: "/financeiro", icon: "list", roles: ["super_admin", "finance"] },
      { id: "financial-charges", label: "Cobranças", path: "/financeiro/cobrancas", icon: "file-invoice", roles: ["super_admin", "finance"] },
      { id: "financial-payout-report", label: "Relatório de repasse", path: "/financeiro/repasses", icon: "file-text", roles: ["super_admin", "finance"] },
    ],
  },
  { id: "bi", label: "BI", path: "/bi", icon: "chart-bar", roles: ["super_admin", "admin"] },
  {
    id: "settings",
    label: "Configurações",
    path: "/configuracoes",
    icon: "settings",
    roles: ["super_admin", "admin"],
    children: [
      {
        id: "settings-core",
        label: "Stayo Core",
        path: "/configuracoes/stayo-core",
        icon: "server-2",
        roles: ["super_admin"],
      },
      {
        id: "settings-integrations",
        label: "Integrações",
        path: "/configuracoes/integracoes",
        icon: "plug",
        roles: ["super_admin", "admin"],
      },
    ],
  },
];

/** Agrupamento puramente visual. Rotas e permissões continuam definidas nos itens acima. */
export const navigationGroups: NavGroup[] = [
  { id: "overview", label: "Visão geral", itemIds: ["dashboard"] },
  { id: "portfolio", label: "Portfólio", itemIds: ["properties", "owners", "condominiums"] },
  { id: "commercial", label: "Comercial", itemIds: ["implementation", "contracts"] },
  {
    id: "operations",
    label: "Operação",
    itemIds: ["operations", "reservations", "guests", "providers"],
  },
  { id: "intelligence", label: "Inteligência", itemIds: ["messages", "products", "bi"] },
  { id: "management", label: "Gestão", itemIds: ["financial"] },
  { id: "system", label: "Sistema", itemIds: ["settings"] },
];
