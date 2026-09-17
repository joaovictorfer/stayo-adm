# Stayo Adm

Crie a base de um painel administrativo interno chamado "Stayo Admin",
para uso da equipe de uma operadora de hospedagem por temporada (tipo
Airbnb/short-stay). Stack: React + TypeScript + Vite + TailwindCSS +
React Router + TanStack Query.

Não crie autenticação, não crie banco de dados, não invente páginas ou
campos além do que estou descrevendo abaixo. Esta fase é só estrutura —
nenhuma tela deve ter lógica de negócio ainda.

1) Crie estes arquivos exatamente com este conteúdo:

--- src/types/core.ts ---
```ts
/**
 * Contratos de dados do Stayo Core API (v1).
 *
 * Estes tipos representam o CONTRATO EXTERNO exposto pelo Core — não a
 * estrutura interna real das tabelas do STAYO.APP. O Admin nunca deve
 * assumir nomes de coluna ou tabela do banco interno; ele só conhece
 * estes formatos.
 *
 * Fonte conceitual: HANDOFF_MASTER seção 10 (Contrato de dados).
 * Os nomes de campo aqui são um ponto de partida e devem ser
 * reconciliados com a Fase 1 (mapa de domínios) antes de virarem
 * contrato definitivo — ver `docs/STAYO_ADMIN_ARCHITECTURE.md`.
 */

export type EntityId = string;

export type ImplementationStatus =
  | "prospect"
  | "proposta"
  | "aguardando_aprovacao"
  | "aprovado"
  | "planejamento"
  | "em_implantacao"
  | "validacao"
  | "pronto_para_operacao"
  | "ativo"
  | "pausado"
  | "nao_convertido"
  | "cancelado";

export type ImplementationItemStatus =
  | "pendente"
  | "em_andamento"
  | "concluido"
  | "bloqueado"
  | "nao_aplicavel"
  | "pulado";

export interface Property {
  id: EntityId;
  externalCode: string;
  name: string;
  condominiumId: EntityId | null;
  condominiumName: string | null;
  unit: string | null;
  city: string | null;
  status: string;
  capacity: number | null;
  checkinTime: string | null;
  checkoutTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Condominium {
  id: EntityId;
  name: string;
  city: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: EntityId;
  externalId: string | null;
  propertyId: EntityId;
  guestId: EntityId | null;
  source: string | null;
  channel: string | null;
  checkin: string;
  checkout: string;
  guestsCount: number | null;
  status: string;
  amount: number | null; // presente apenas quando o scope financial.read for concedido
  createdAt: string;
  updatedAt: string;
}

export interface Guest {
  id: EntityId;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  // Campos sensíveis (documento, selfie) NUNCA trafegam neste tipo.
  // Eles ficam atrás de um endpoint/scopo separado e mais restrito.
}

export interface Owner {
  id: EntityId;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Entidade que só existe no Admin até virar Property/Owner oficiais no Core. */
export interface ImplementationProject {
  id: EntityId;
  code: string; // ex: IMP-00127
  status: ImplementationStatus;
  ownerProspect: {
    name: string;
    phone: string;
    email: string | null;
  };
  condominiumName: string | null;
  unit: string | null;
  city: string | null;
  responsibleUserId: EntityId | null;
  startDateEstimate: string | null;
  completionDateEstimate: string | null;
  notes: string | null;
  origin: string | null;
  createdAt: string;
  updatedAt: string;

  // Preenchidos somente após a conversão (ver seção 24/62 do handoff)
  corePropertyId: EntityId | null;
  coreOwnerId: EntityId | null;
}

export interface ImplementationItem {
  id: EntityId;
  implementationId: EntityId;
  category: string;
  phase: string;
  title: string;
  description: string | null;
  order: number;
  responsibleUserId: EntityId | null;
  dueDate: string | null;
  status: ImplementationItemStatus;
  observation: string | null;
  mandatory: boolean;
  blocker: boolean;
  ownerVisible: boolean;
  completedAt: string | null;
  completedBy: EntityId | null;
}

export interface ProposalItem {
  description: string;
  quantity: number;
  unitValue: number;
  discount: number;
  total: number;
}

export interface Proposal {
  id: EntityId;
  implementationId: EntityId;
  version: number;
  items: ProposalItem[];
  total: number;
  acceptedAt: string | null;
  createdAt: string;
}
```

--- src/lib/api/core-client.ts ---
```ts
/**
 * Camada de acesso ao Stayo Core API.
 *
 * REGRA DE OURO (handoff seção 39/71): o Stayo Admin é um sistema apartado
 * e NUNCA acessa o banco do STAYO.APP diretamente. Toda leitura/escrita
 * passa por esta interface. Enquanto o Core real não existe, usamos
 * `createMockCoreApiClient()` — nenhuma tela deve importar `fetch`
 * diretamente para dados de negócio.
 *
 * Quando o Core v1 (properties, condominiums, reservations, guests)
 * estiver no ar, troca-se apenas `createCoreApiClient()` — nenhum
 * componente de UI muda.
 */

import type {
  Property,
  Condominium,
  Reservation,
  Guest,
  Owner,
  ImplementationProject,
  ImplementationItem,
  Proposal,
  EntityId,
} from "../../types/core";

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

export interface CoreApiClient {
  health(): Promise<{ status: "ok" | "degraded" | "down"; version: string }>;

  properties: {
    list(params?: { cursor?: string; q?: string }): Promise<Page<Property>>;
    get(id: EntityId): Promise<Property | null>;
  };

  condominiums: {
    list(params?: { cursor?: string; q?: string }): Promise<Page<Condominium>>;
  };

  reservations: {
    list(params?: { cursor?: string; propertyId?: EntityId }): Promise<Page<Reservation>>;
    get(id: EntityId): Promise<Reservation | null>;
  };

  guests: {
    get(id: EntityId): Promise<Guest | null>;
  };

  owners: {
    search(q: string): Promise<Owner[]>;
  };

  // Estes três recursos abaixo, por ora, não existem no Core (ele ainda
  // não tem domínio de implantação). Ficam aqui apenas como o contrato
  // que o Admin espera, mesmo que hoje resolvam localmente/mock — assim
  // a UI já nasce escrita contra a forma final.
  implementations: {
    list(params?: { cursor?: string; status?: string }): Promise<Page<ImplementationProject>>;
    get(id: EntityId): Promise<ImplementationProject | null>;
    create(input: Partial<ImplementationProject>): Promise<ImplementationProject>;
    items(implementationId: EntityId): Promise<ImplementationItem[]>;
  };

  proposals: {
    list(implementationId: EntityId): Promise<Proposal[]>;
  };
}

export interface CoreApiConfig {
  baseUrl: string;
  /** Credencial da aplicação "Stayo Admin" — nunca uma chave mestra. */
  appToken: string;
}

/** Implementação real, usada quando o Stayo Core v1 estiver disponível. */
export function createCoreApiClient(config: CoreApiConfig): CoreApiClient {
  const request = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${config.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${config.appToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Core API error ${res.status} on ${path}`);
    }
    return res.json() as Promise<T>;
  };

  return {
    health: () => request("/api/core/v1/health"),
    properties: {
      list: (params) => request(`/api/core/v1/properties${queryString(params)}`),
      get: (id) => request(`/api/core/v1/properties/${id}`),
    },
    condominiums: {
      list: (params) => request(`/api/core/v1/condominiums${queryString(params)}`),
    },
    reservations: {
      list: (params) => request(`/api/core/v1/reservations${queryString(params)}`),
      get: (id) => request(`/api/core/v1/reservations/${id}`),
    },
    guests: {
      get: (id) => request(`/api/core/v1/guests/${id}`),
    },
    owners: {
      search: (q) => request(`/api/core/v1/owners${queryString({ q })}`),
    },
    implementations: {
      list: (params) => request(`/api/core/v1/implementations${queryString(params)}`),
      get: (id) => request(`/api/core/v1/implementations/${id}`),
      create: async () => {
        throw new Error("create() ainda não implementado no cliente real");
      },
      items: (implementationId) =>
        request(`/api/core/v1/implementations/${implementationId}/items`),
    },
    proposals: {
      list: (implementationId) =>
        request(`/api/core/v1/implementations/${implementationId}/proposals`),
    },
  };
}

function queryString(params?: Record<string, unknown>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries as [string, string][]).toString();
}

/**
 * Implementação mock — usada nesta fase (shell/arquitetura), antes de o
 * Stayo Core v1 existir. Dados fixos, sem chamadas de rede, sem PII real.
 */
export function createMockCoreApiClient(): CoreApiClient {
  const empty = <T>(): Promise<Page<T>> => Promise.resolve({ data: [], nextCursor: null });

  return {
    health: () => Promise.resolve({ status: "ok", version: "mock" }),
    properties: { list: () => empty(), get: () => Promise.resolve(null) },
    condominiums: { list: () => empty() },
    reservations: { list: () => empty(), get: () => Promise.resolve(null) },
    guests: { get: () => Promise.resolve(null) },
    owners: { search: () => Promise.resolve([]) },
    implementations: {
      list: () => empty(),
      get: () => Promise.resolve(null),
      create: (input) =>
        Promise.resolve({
          id: crypto.randomUUID(),
          code: "IMP-00000",
          status: "prospect",
          ownerProspect: { name: "", phone: "", email: null },
          condominiumName: null,
          unit: null,
          city: null,
          responsibleUserId: null,
          startDateEstimate: null,
          completionDateEstimate: null,
          notes: null,
          origin: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          corePropertyId: null,
          coreOwnerId: null,
          ...input,
        }),
      items: () => Promise.resolve([]),
    },
    proposals: { list: () => Promise.resolve([]) },
  };
}

/** Ponto único de decisão mock vs real — nenhuma tela deve checar env var. */
export function createDefaultCoreApiClient(): CoreApiClient {
  const baseUrl = import.meta.env.VITE_CORE_API_URL as string | undefined;
  const appToken = import.meta.env.VITE_CORE_APP_TOKEN as string | undefined;

  if (!baseUrl || !appToken) {
    return createMockCoreApiClient();
  }
  return createCoreApiClient({ baseUrl, appToken });
}
```

--- src/config/navigation.ts ---
```ts
/**
 * Mapa de navegação do Stayo Admin.
 *
 * `roles` é só o placeholder de RBAC (handoff seção 42) — a permissão
 * REAL sempre vive no backend/RLS do Core, nunca só aqui. Esconder um
 * item de menu não é controle de acesso.
 */

export type StayoRole =
  | "super_admin"
  | "admin"
  | "operations"
  | "commercial"
  | "finance"
  | "viewer";

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string; // nome do ícone Tabler, ex: "home", "building"
  roles: StayoRole[];
  children?: NavItem[];
}

export const navigation: NavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: "layout-dashboard", roles: ["super_admin", "admin", "operations", "commercial", "finance", "viewer"] },
  { id: "properties", label: "Imóveis", path: "/imoveis", icon: "building", roles: ["super_admin", "admin", "operations", "viewer"] },
  { id: "condominiums", label: "Condomínios", path: "/condominios", icon: "building-community", roles: ["super_admin", "admin", "operations", "viewer"] },
  { id: "reservations", label: "Reservas", path: "/reservas", icon: "calendar", roles: ["super_admin", "admin", "operations", "viewer"] },
  { id: "guests", label: "Hóspedes", path: "/hospedes", icon: "users", roles: ["super_admin", "admin", "operations"] },
  {
    id: "implementation",
    label: "Implantação",
    path: "/implantacao",
    icon: "clipboard-list",
    roles: ["super_admin", "admin", "operations", "commercial"],
    children: [
      { id: "implementation-list", label: "Implantações", path: "/implantacao", icon: "list", roles: ["super_admin", "admin", "operations", "commercial"] },
      { id: "implementation-templates", label: "Templates", path: "/implantacao/templates", icon: "template", roles: ["super_admin", "admin"] },
      { id: "implementation-proposals", label: "Propostas", path: "/implantacao/propostas", icon: "file-invoice", roles: ["super_admin", "admin", "commercial"] },
    ],
  },
  { id: "inspections", label: "Vistorias", path: "/vistorias", icon: "checklist", roles: ["super_admin", "admin", "operations"] },
  { id: "operations", label: "Operação", path: "/operacao", icon: "settings-automation", roles: ["super_admin", "admin", "operations"] },
  { id: "messages", label: "Mensagens", path: "/mensagens", icon: "message-circle", roles: ["super_admin", "admin", "operations"] },
  { id: "owners", label: "Proprietários", path: "/proprietarios", icon: "user-star", roles: ["super_admin", "admin", "commercial"] },
  { id: "contracts", label: "Contratos", path: "/contratos", icon: "file-text", roles: ["super_admin", "admin", "commercial"] },
  { id: "guide", label: "Guia / Conteúdo", path: "/guia", icon: "book", roles: ["super_admin", "admin", "operations"] },
  { id: "products", label: "Produtos / Serviços", path: "/produtos", icon: "shopping-bag", roles: ["super_admin", "admin", "commercial"] },
  { id: "financial", label: "Financeiro", path: "/financeiro", icon: "currency-dollar", roles: ["super_admin", "finance"] },
  { id: "bi", label: "BI", path: "/bi", icon: "chart-bar", roles: ["super_admin", "admin"] },
  {
    id: "settings",
    label: "Configurações",
    path: "/configuracoes",
    icon: "settings",
    roles: ["super_admin", "admin"],
    children: [
      { id: "settings-core", label: "Stayo Core", path: "/configuracoes/stayo-core", icon: "server-2", roles: ["super_admin"] },
      { id: "settings-integrations", label: "Integrações", path: "/configuracoes/integracoes", icon: "plug", roles: ["super_admin", "admin"] },
    ],
  },
];
```

--- src/config/theme.css ---
```css
/**
 * Tokens visuais do Stayo Admin.
 *
 * Direção: hospitalidade premium operacional — não é um site de marketing
 * (sem hero, sem gradiente), é uma ferramenta que a equipe usa o dia
 * inteiro no computador e, em campo (vistoria/implantação), no celular.
 * A paleta parte do "verde institucional Stayo" citado no handoff
 * (seção 44), lido como um verde-floresta abafado — não um verde-SaaS
 * saturado — combinado com um dourado latão discreto para as ações que
 * dependem de alguém fora da equipe (proprietário) responder.
 */

:root {
  /* Base */
  --stayo-ink: #1b231d;          /* texto primário, títulos */
  --stayo-ink-muted: #5c665f;    /* texto secundário */
  --stayo-bg: #f1f3ee;           /* fundo de página — verde-acinzentado suave */
  --stayo-surface: #fdfdfb;      /* cards */
  --stayo-border: #e0ded2;       /* divisores, bordas de card */

  /* Marca / ações primárias */
  --stayo-forest: #21402e;
  --stayo-forest-strong: #163020;
  --stayo-forest-soft: #e4ebe4;  /* fundo de badge/estado "ativo" */

  /* Ação pendente de terceiro (proprietário) — "precisamos de você" */
  --stayo-gold: #b98f46;
  --stayo-gold-soft: #f4ecd9;

  /* Estados semânticos */
  --stayo-success: #3b6d11;
  --stayo-warning: #97661e;
  --stayo-danger: #8c3a2e;

  /* Tipografia */
  --stayo-font-display: "Fraunces", Georgia, serif; /* números de dashboard, títulos de fase/etapa */
  --stayo-font-ui: "IBM Plex Sans", system-ui, sans-serif; /* nav, tabelas, formulários */

  --radius-card: 12px;
  --radius-control: 8px;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --stayo-ink: #ecefe9;
    --stayo-ink-muted: #a3ac9f;
    --stayo-bg: #141713;
    --stayo-surface: #1c1f1a;
    --stayo-border: #2b2e27;
    --stayo-forest-soft: #1f2c22;
    --stayo-gold-soft: #2c2517;
  }
}

:root[data-theme="dark"] {
  --stayo-ink: #ecefe9;
  --stayo-ink-muted: #a3ac9f;
  --stayo-bg: #141713;
  --stayo-surface: #1c1f1a;
  --stayo-border: #2b2e27;
  --stayo-forest-soft: #1f2c22;
  --stayo-gold-soft: #2c2517;
}
```

2) Monte um layout de shell administrativo:
- Sidebar à esquerda no desktop, virando um drawer (menu gaveta) no
  mobile, renderizada a partir do array `navigation` de
  src/config/navigation.ts (respeite a hierarquia: itens com `children`
  abrem um submenu).
- Barra superior simples com o nome da seção atual (breadcrumb).
- Área de conteúdo central.
- Aplique as cores e tipografia de theme.css via variáveis CSS — não
  troque por uma paleta padrão do Tailwind.

3) Crie uma rota para cada item (e subitem) de `navigation`, apontando
todas, por enquanto, para um componente genérico `EmptyState` que mostra
o título da seção e o texto "Em construção" — sem dados fake, sem
conteúdo de exemplo com nomes de hóspedes ou imóveis inventados.

4) Instale TanStack Query e envolva a aplicação com o QueryClientProvider,
mas não crie nenhuma query ainda — isso vem na próxima fase.

Não adicione nada além do que está listado acima.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/696b2125-0bf9-4538-8458-05d88fc5e8a2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
