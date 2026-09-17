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
  Inspection,
  OperationTask,
  Conversation,
  ConversationMessage,
  Contract,
  ImplementationProject,
  ImplementationItem,
  Proposal,
  EntityId,
  GuideEntry,
  UpsellProduct,
  Expense,
  Payout,
  ServiceInvoice,
  ServiceProvider,
  Settlement,
} from "../../types/core";
import type {
  ConsumerApp,
  CoreLogEntry,
  CoreOverview,
  CoreScope,
  CoreWebhook,
} from "../../types/core-admin";

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
    get(id: EntityId): Promise<Condominium | null>;
  };

  reservations: {
    list(params?: { cursor?: string; propertyId?: EntityId }): Promise<Page<Reservation>>;
    get(id: EntityId): Promise<Reservation | null>;
  };

  guests: {
    list(params?: { cursor?: string; q?: string }): Promise<Page<Guest>>;
    get(id: EntityId): Promise<Guest | null>;
  };

  owners: {
    list(params?: { cursor?: string; q?: string }): Promise<Page<Owner>>;
    get(id: EntityId): Promise<Owner | null>;
    search(q: string): Promise<Owner[]>;
  };

  inspections: {
    list(params?: { cursor?: string; type?: string }): Promise<Page<Inspection>>;
    get(id: EntityId): Promise<Inspection | null>;
  };

  operations: {
    list(params?: { cursor?: string; status?: string }): Promise<Page<OperationTask>>;
    get(id: EntityId): Promise<OperationTask | null>;
  };

  /** Lê da Central de Mensagens do STAYO.APP quando o Core expuser. */
  conversations: {
    list(params?: { cursor?: string; q?: string }): Promise<Page<Conversation>>;
    get(id: EntityId): Promise<Conversation | null>;
    messages(conversationId: EntityId): Promise<ConversationMessage[]>;
  };

  contracts: {
    list(params?: { cursor?: string; q?: string }): Promise<Page<Contract>>;
    get(id: EntityId): Promise<Contract | null>;
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

  guide: {
    list(params?: { cursor?: string }): Promise<Page<GuideEntry>>;
    get(id: EntityId): Promise<GuideEntry | null>;
  };

  products: {
    list(params?: { cursor?: string }): Promise<Page<UpsellProduct>>;
    get(id: EntityId): Promise<UpsellProduct | null>;
  };

  /** Repasses — requer scope financial.read; nunca expõe dado de hóspede. */
  payouts: {
    list(params?: { cursor?: string }): Promise<Page<Payout>>;
    get(id: EntityId): Promise<Payout | null>;
  };

  /** Faturas de serviço cobradas do proprietário — requer scope financial.read. */
  serviceInvoices: {
    list(params?: { cursor?: string; q?: string }): Promise<Page<ServiceInvoice>>;
    get(id: EntityId): Promise<ServiceInvoice | null>;
  };

  /** Cadastro de prestadores de serviço (limpeza, manutenção etc.). */
  serviceProviders: {
    list(params?: { cursor?: string; q?: string }): Promise<Page<ServiceProvider>>;
    get(id: EntityId): Promise<ServiceProvider | null>;
  };

  /** Fechamentos de pagamento a prestadores por período. */
  settlements: {
    list(params?: { cursor?: string; providerId?: EntityId }): Promise<Page<Settlement>>;
    get(id: EntityId): Promise<Settlement | null>;
  };

  /** Despesas operacionais lançadas contra um imóvel. */
  expenses: {
    list(params?: { cursor?: string; propertyId?: EntityId }): Promise<Page<Expense>>;
    get(id: EntityId): Promise<Expense | null>;
  };

  /** Área técnica de Configurações → Stayo Core. */
  admin: {
    overview(): Promise<CoreOverview>;
    apps(): Promise<ConsumerApp[]>;
    scopes(): Promise<CoreScope[]>;
    webhooks(): Promise<CoreWebhook[]>;
    retryWebhook(id: EntityId): Promise<void>;
    /** Nunca retorna senha, token, documento ou selfie. */
    logs(params?: { cursor?: string }): Promise<Page<CoreLogEntry>>;
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
      get: (id) => request(`/api/core/v1/condominiums/${id}`),
    },
    reservations: {
      list: (params) => request(`/api/core/v1/reservations${queryString(params)}`),
      get: (id) => request(`/api/core/v1/reservations/${id}`),
    },
    guests: {
      list: (params) => request(`/api/core/v1/guests${queryString(params)}`),
      get: (id) => request(`/api/core/v1/guests/${id}`),
    },
    owners: {
      list: (params) => request(`/api/core/v1/owners${queryString(params)}`),
      get: (id) => request(`/api/core/v1/owners/${id}`),
      search: (q) => request(`/api/core/v1/owners${queryString({ q })}`),
    },
    inspections: {
      list: (params) => request(`/api/core/v1/inspections${queryString(params)}`),
      get: (id) => request(`/api/core/v1/inspections/${id}`),
    },
    operations: {
      list: (params) => request(`/api/core/v1/operations/tasks${queryString(params)}`),
      get: (id) => request(`/api/core/v1/operations/tasks/${id}`),
    },
    conversations: {
      list: (params) => request(`/api/core/v1/conversations${queryString(params)}`),
      get: (id) => request(`/api/core/v1/conversations/${id}`),
      messages: (conversationId) =>
        request(`/api/core/v1/conversations/${conversationId}/messages`),
    },
    contracts: {
      list: (params) => request(`/api/core/v1/contracts${queryString(params)}`),
      get: (id) => request(`/api/core/v1/contracts/${id}`),
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
    guide: {
      list: (params) => request(`/api/core/v1/guide/entries${queryString(params)}`),
      get: (id) => request(`/api/core/v1/guide/entries/${id}`),
    },
    products: {
      list: (params) => request(`/api/core/v1/products${queryString(params)}`),
      get: (id) => request(`/api/core/v1/products/${id}`),
    },
    payouts: {
      list: (params) => request(`/api/core/v1/financial/payouts${queryString(params)}`),
      get: (id) => request(`/api/core/v1/financial/payouts/${id}`),
    },
    serviceInvoices: {
      list: (params) => request(`/api/core/v1/financial/service-invoices${queryString(params)}`),
      get: (id) => request(`/api/core/v1/financial/service-invoices/${id}`),
    },
    serviceProviders: {
      list: (params) => request(`/api/core/v1/service-providers${queryString(params)}`),
      get: (id) => request(`/api/core/v1/service-providers/${id}`),
    },
    settlements: {
      list: (params) => request(`/api/core/v1/financial/settlements${queryString(params)}`),
      get: (id) => request(`/api/core/v1/financial/settlements/${id}`),
    },
    expenses: {
      list: (params) => request(`/api/core/v1/financial/expenses${queryString(params)}`),
      get: (id) => request(`/api/core/v1/financial/expenses/${id}`),
    },
    admin: {
      overview: () => request("/api/core/v1/admin/overview"),
      apps: () => request("/api/core/v1/admin/apps"),
      scopes: () => request("/api/core/v1/admin/scopes"),
      webhooks: () => request("/api/core/v1/admin/webhooks"),
      retryWebhook: async () => {
        throw new Error("retryWebhook() ainda não implementado no cliente real");
      },
      logs: (params) => request(`/api/core/v1/admin/logs${queryString(params)}`),
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
    condominiums: { list: () => empty(), get: () => Promise.resolve(null) },
    reservations: { list: () => empty(), get: () => Promise.resolve(null) },
    guests: { list: () => empty(), get: () => Promise.resolve(null) },
    owners: {
      list: () => empty(),
      get: () => Promise.resolve(null),
      search: () => Promise.resolve([]),
    },
    inspections: { list: () => empty(), get: () => Promise.resolve(null) },
    operations: { list: () => empty(), get: () => Promise.resolve(null) },
    conversations: {
      list: () => empty(),
      get: () => Promise.resolve(null),
      messages: () => Promise.resolve([]),
    },
    contracts: { list: () => empty(), get: () => Promise.resolve(null) },
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
    guide: { list: () => empty(), get: () => Promise.resolve(null) },
    products: { list: () => empty(), get: () => Promise.resolve(null) },
    payouts: { list: () => empty(), get: () => Promise.resolve(null) },
    serviceInvoices: { list: () => empty(), get: () => Promise.resolve(null) },
    serviceProviders: { list: () => empty(), get: () => Promise.resolve(null) },
    settlements: { list: () => empty(), get: () => Promise.resolve(null) },
    expenses: { list: () => empty(), get: () => Promise.resolve(null) },
    admin: {
      overview: () =>
        Promise.resolve({
          health: {
            status: "down" as const,
            version: "mock",
            checkedAt: new Date().toISOString(),
            uptimePercent: null,
            latencyMs: null,
          },
          api: {
            version: "v1 (não conectado)",
            baseUrl: null,
            docsUrl: null,
            environment: null,
            status: "down" as const,
          },
          appsCount: mockApps.length,
          recentEvents: [],
          recentErrors: [],
        }),
      apps: () => Promise.resolve(mockApps),
      scopes: () => Promise.resolve(mockScopes),
      webhooks: () => Promise.resolve([]),
      retryWebhook: () => Promise.resolve(),
      logs: () => empty(),
    },
  };
}

/**
 * Catálogo de apps consumidores e de scopes.
 * Cada app tem credencial própria — nunca existe chave mestra compartilhada.
 * Os segredos nunca trafegam para a UI: apenas o identificador da credencial.
 */
const mockApps: ConsumerApp[] = [
  {
    id: "app-stayo-admin",
    name: "Stayo Admin",
    description: "Painel interno da equipe.",
    credentialId: null,
    credentialCreatedAt: null,
    credentialLastRotatedAt: null,
    active: true,
    scopes: ["properties.read", "reservations.read", "guests.read", "owners.read"],
  },
  {
    id: "app-stayo-agents",
    name: "Stayo Agents",
    description: "Automações e agentes de atendimento.",
    credentialId: null,
    credentialCreatedAt: null,
    credentialLastRotatedAt: null,
    active: false,
    scopes: ["properties.read", "reservations.read", "messages.read", "messages.write"],
  },
  {
    id: "app-financeiro",
    name: "Financeiro",
    description: "Conciliação e repasses.",
    credentialId: null,
    credentialCreatedAt: null,
    credentialLastRotatedAt: null,
    active: false,
    scopes: ["reservations.read", "financial.read", "financial.write"],
  },
];

const mockScopes: CoreScope[] = [
  { name: "properties.read", description: "Ler imóveis e condomínios.", sensitive: false },
  { name: "properties.write", description: "Criar e alterar imóveis.", sensitive: false },
  { name: "reservations.read", description: "Ler reservas.", sensitive: false },
  { name: "reservations.write", description: "Criar e alterar reservas.", sensitive: false },
  { name: "guests.read", description: "Ler dados de contato de hóspedes.", sensitive: true },
  { name: "owners.read", description: "Ler dados de proprietários.", sensitive: true },
  { name: "messages.read", description: "Ler conversas da Central de Mensagens.", sensitive: true },
  { name: "messages.write", description: "Responder conversas.", sensitive: true },
  { name: "financial.read", description: "Ler valores e repasses.", sensitive: true },
  { name: "financial.write", description: "Lançar movimentações financeiras.", sensitive: true },
];

/** Ponto único de decisão mock vs real — nenhuma tela deve checar env var. */
export function createDefaultCoreApiClient(): CoreApiClient {
  const baseUrl = import.meta.env["VITE_CORE_API_URL"] as string | undefined;
  const appToken = import.meta.env["VITE_CORE_APP_TOKEN"] as string | undefined;

  if (!baseUrl || !appToken) {
    return createMockCoreApiClient();
  }
  return createCoreApiClient({ baseUrl, appToken });
}
