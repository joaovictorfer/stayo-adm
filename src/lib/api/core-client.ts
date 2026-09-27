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
import { checklistTemplatesStore, newId, read, write } from "./local-store";
import { nextImplementationCode } from "../implementation-status";

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
    create(input: Omit<Inspection, "id" | "createdAt" | "updatedAt">): Promise<Inspection>;
    update(id: EntityId, patch: Partial<Omit<Inspection, "id" | "createdAt">>): Promise<Inspection>;
  };

  operations: {
    list(params?: { cursor?: string; status?: string }): Promise<Page<OperationTask>>;
    get(id: EntityId): Promise<OperationTask | null>;
    create(
      input: Omit<OperationTask, "id" | "assignments" | "createdAt" | "updatedAt">,
    ): Promise<OperationTask>;
    update(
      id: EntityId,
      patch: Partial<Omit<OperationTask, "id" | "createdAt">>,
    ): Promise<OperationTask>;
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
    /** `code` é gerado pelo adapter — nunca calculado no componente. */
    create(input: Omit<Partial<ImplementationProject>, "code">): Promise<ImplementationProject>;
    update(
      id: EntityId,
      patch: Partial<Omit<ImplementationProject, "id" | "code" | "createdAt">>,
    ): Promise<ImplementationProject>;
    items(implementationId: EntityId): Promise<ImplementationItem[]>;
    /** Clona o template de checklist vigente para esta implantação. Idempotente: se já existem itens, apenas os retorna. */
    generateChecklist(implementationId: EntityId): Promise<ImplementationItem[]>;
    updateChecklistItem(
      itemId: EntityId,
      patch: Partial<Omit<ImplementationItem, "id" | "implementationId">>,
    ): Promise<ImplementationItem>;
  };

  proposals: {
    list(implementationId: EntityId): Promise<Proposal[]>;
  };

  guide: {
    list(params?: { cursor?: string }): Promise<Page<GuideEntry>>;
    get(id: EntityId): Promise<GuideEntry | null>;
    create(input: Omit<GuideEntry, "id" | "createdAt" | "updatedAt">): Promise<GuideEntry>;
    update(
      id: EntityId,
      input: Omit<GuideEntry, "id" | "createdAt" | "updatedAt">,
    ): Promise<GuideEntry>;
    remove(id: EntityId): Promise<void>;
  };

  products: {
    list(params?: { cursor?: string }): Promise<Page<UpsellProduct>>;
    get(id: EntityId): Promise<UpsellProduct | null>;
    create(input: Omit<UpsellProduct, "id" | "createdAt" | "updatedAt">): Promise<UpsellProduct>;
    update(
      id: EntityId,
      input: Omit<UpsellProduct, "id" | "createdAt" | "updatedAt">,
    ): Promise<UpsellProduct>;
    remove(id: EntityId): Promise<void>;
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
      create: async () => {
        throw new Error("create() ainda não implementado no cliente real");
      },
      update: async () => {
        throw new Error("update() ainda não implementado no cliente real");
      },
    },
    operations: {
      list: (params) => request(`/api/core/v1/operations/tasks${queryString(params)}`),
      get: (id) => request(`/api/core/v1/operations/tasks/${id}`),
      create: async () => {
        throw new Error("create() ainda não implementado no cliente real");
      },
      update: async () => {
        throw new Error("update() ainda não implementado no cliente real");
      },
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
      update: async () => {
        throw new Error("update() ainda não implementado no cliente real");
      },
      items: (implementationId) =>
        request(`/api/core/v1/implementations/${implementationId}/items`),
      generateChecklist: async () => {
        throw new Error("generateChecklist() ainda não implementado no cliente real");
      },
      updateChecklistItem: async () => {
        throw new Error("updateChecklistItem() ainda não implementado no cliente real");
      },
    },
    proposals: {
      list: (implementationId) =>
        request(`/api/core/v1/implementations/${implementationId}/proposals`),
    },
    guide: {
      list: (params) => request(`/api/core/v1/guide/entries${queryString(params)}`),
      get: (id) => request(`/api/core/v1/guide/entries/${id}`),
      create: async () => {
        throw new Error("create() ainda não implementado no cliente real");
      },
      update: async () => {
        throw new Error("update() ainda não implementado no cliente real");
      },
      remove: async () => {
        throw new Error("remove() ainda não implementado no cliente real");
      },
    },
    products: {
      list: (params) => request(`/api/core/v1/products${queryString(params)}`),
      get: (id) => request(`/api/core/v1/products/${id}`),
      create: async () => {
        throw new Error("create() ainda não implementado no cliente real");
      },
      update: async () => {
        throw new Error("update() ainda não implementado no cliente real");
      },
      remove: async () => {
        throw new Error("remove() ainda não implementado no cliente real");
      },
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
const GUIDE_KEY = "stayo-admin:guide-entries";
const PRODUCTS_KEY = "stayo-admin:products";
const OPERATION_TASKS_KEY = "stayo-admin:operation-tasks";
const INSPECTIONS_KEY = "stayo-admin:inspections";
const IMPLEMENTATIONS_KEY = "stayo-admin:implementations";
const IMPLEMENTATION_ITEMS_KEY = "stayo-admin:implementation-items";

const MOCK_TEST_CONDOMINIUM: Condominium = {
  id: "2f42cc75-34c8-46a0-9990-108946882a8f",
  name: "Condomínio Teste",
  city: "Gramado",
  createdAt: "2026-09-27T22:49:00.000Z",
  updatedAt: "2026-09-27T22:49:00.000Z",
};

const MOCK_TEST_PROPERTY: Property = {
  id: "7f7cf6de-6e96-4c41-8fb3-71ddb9b4e620",
  externalCode: "TESTE-001",
  name: "Imóvel Teste · Unidade 101",
  condominiumId: MOCK_TEST_CONDOMINIUM.id,
  condominiumName: MOCK_TEST_CONDOMINIUM.name,
  unit: "101",
  city: "Gramado",
  status: "teste",
  capacity: 4,
  checkinTime: null,
  checkoutTime: null,
  ownerId: null,
  ownerName: null,
  createdAt: "2026-09-27T22:49:00.000Z",
  updatedAt: "2026-09-27T22:49:00.000Z",
};

export function createMockCoreApiClient(): CoreApiClient {
  const empty = <T>(): Promise<Page<T>> => Promise.resolve({ data: [], nextCursor: null });

  return {
    health: () => Promise.resolve({ status: "ok", version: "mock" }),
    properties: {
      list: () => Promise.resolve({ data: [MOCK_TEST_PROPERTY], nextCursor: null }),
      get: (id) => Promise.resolve(id === MOCK_TEST_PROPERTY.id ? MOCK_TEST_PROPERTY : null),
    },
    condominiums: {
      list: () => Promise.resolve({ data: [MOCK_TEST_CONDOMINIUM], nextCursor: null }),
      get: (id) =>
        Promise.resolve(id === MOCK_TEST_CONDOMINIUM.id ? MOCK_TEST_CONDOMINIUM : null),
    },
    reservations: { list: () => empty(), get: () => Promise.resolve(null) },
    guests: { list: () => empty(), get: () => Promise.resolve(null) },
    owners: {
      list: () => empty(),
      get: () => Promise.resolve(null),
      search: () => Promise.resolve([]),
    },
    inspections: {
      list: () => Promise.resolve({ data: read<Inspection>(INSPECTIONS_KEY), nextCursor: null }),
      get: (id) =>
        Promise.resolve(read<Inspection>(INSPECTIONS_KEY).find((i) => i.id === id) ?? null),
      create: (input) => {
        const inspection: Inspection = {
          ...input,
          id: newId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        write(INSPECTIONS_KEY, [...read<Inspection>(INSPECTIONS_KEY), inspection]);
        return Promise.resolve(inspection);
      },
      update: (id, patch) => {
        const all = read<Inspection>(INSPECTIONS_KEY);
        const target = all.find((i) => i.id === id);
        if (!target) return Promise.reject(new Error("Vistoria não encontrada"));
        const updated: Inspection = {
          ...target,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        write(
          INSPECTIONS_KEY,
          all.map((i) => (i.id === id ? updated : i)),
        );
        return Promise.resolve(updated);
      },
    },
    operations: {
      list: () =>
        Promise.resolve({ data: read<OperationTask>(OPERATION_TASKS_KEY), nextCursor: null }),
      get: (id) =>
        Promise.resolve(read<OperationTask>(OPERATION_TASKS_KEY).find((t) => t.id === id) ?? null),
      create: (input) => {
        const task: OperationTask = {
          ...input,
          id: newId(),
          assignments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        write(OPERATION_TASKS_KEY, [...read<OperationTask>(OPERATION_TASKS_KEY), task]);
        return Promise.resolve(task);
      },
      update: (id, patch) => {
        const all = read<OperationTask>(OPERATION_TASKS_KEY);
        const target = all.find((t) => t.id === id);
        if (!target) return Promise.reject(new Error("Rotina não encontrada"));
        const updated: OperationTask = {
          ...target,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        write(
          OPERATION_TASKS_KEY,
          all.map((t) => (t.id === id ? updated : t)),
        );
        return Promise.resolve(updated);
      },
    },
    conversations: {
      list: () => empty(),
      get: () => Promise.resolve(null),
      messages: () => Promise.resolve([]),
    },
    contracts: { list: () => empty(), get: () => Promise.resolve(null) },
    implementations: {
      list: () =>
        Promise.resolve({
          data: read<ImplementationProject>(IMPLEMENTATIONS_KEY),
          nextCursor: null,
        }),
      get: (id) =>
        Promise.resolve(
          read<ImplementationProject>(IMPLEMENTATIONS_KEY).find((i) => i.id === id) ?? null,
        ),
      create: (input) => {
        const existingCodes = read<ImplementationProject>(IMPLEMENTATIONS_KEY).map((i) => i.code);
        const project: ImplementationProject = {
          id: crypto.randomUUID(),
          code: nextImplementationCode(existingCodes),
          status: "prospect",
          ownerId: null,
          ownerName: null,
          ownerPhone: null,
          nickname: null,
          condominiumName: null,
          unit: null,
          address: null,
          postalCode: null,
          city: null,
          propertyType: null,
          bedrooms: null,
          capacity: null,
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
        };
        write(IMPLEMENTATIONS_KEY, [...read<ImplementationProject>(IMPLEMENTATIONS_KEY), project]);
        return Promise.resolve(project);
      },
      update: (id, patch) => {
        const all = read<ImplementationProject>(IMPLEMENTATIONS_KEY);
        const target = all.find((i) => i.id === id);
        if (!target) return Promise.reject(new Error("Implantação não encontrada"));
        const updated: ImplementationProject = {
          ...target,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        write(
          IMPLEMENTATIONS_KEY,
          all.map((i) => (i.id === id ? updated : i)),
        );
        return Promise.resolve(updated);
      },
      items: (implementationId) =>
        Promise.resolve(
          read<ImplementationItem>(IMPLEMENTATION_ITEMS_KEY).filter(
            (i) => i.implementationId === implementationId,
          ),
        ),
      generateChecklist: async (implementationId) => {
        const existing = read<ImplementationItem>(IMPLEMENTATION_ITEMS_KEY).filter(
          (i) => i.implementationId === implementationId,
        );
        if (existing.length > 0) return existing;
        const templates = await checklistTemplatesStore.list();
        const generated: ImplementationItem[] = templates.map((t) => ({
          id: newId(),
          implementationId,
          category: t.category,
          phase: t.phase,
          title: t.title,
          description: t.description,
          order: t.order,
          responsibleUserId: null,
          dueDate: null,
          status: "pendente",
          observation: null,
          mandatory: t.mandatory,
          blocker: t.blocker,
          ownerVisible: t.ownerVisible,
          completedAt: null,
          completedBy: null,
          readinessOverrideReason: null,
          readinessOverrideBy: null,
          readinessOverrideAt: null,
        }));
        write(IMPLEMENTATION_ITEMS_KEY, [
          ...read<ImplementationItem>(IMPLEMENTATION_ITEMS_KEY),
          ...generated,
        ]);
        return generated;
      },
      updateChecklistItem: (itemId, patch) => {
        const all = read<ImplementationItem>(IMPLEMENTATION_ITEMS_KEY);
        const target = all.find((i) => i.id === itemId);
        if (!target) return Promise.reject(new Error("Item de checklist não encontrado"));
        const updated: ImplementationItem = { ...target, ...patch };
        write(
          IMPLEMENTATION_ITEMS_KEY,
          all.map((i) => (i.id === itemId ? updated : i)),
        );
        return Promise.resolve(updated);
      },
    },
    proposals: { list: () => Promise.resolve([]) },
    guide: {
      list: () => Promise.resolve({ data: read<GuideEntry>(GUIDE_KEY), nextCursor: null }),
      get: (id) => Promise.resolve(read<GuideEntry>(GUIDE_KEY).find((g) => g.id === id) ?? null),
      create: (input) => {
        const entry: GuideEntry = {
          ...input,
          id: newId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        write(GUIDE_KEY, [...read<GuideEntry>(GUIDE_KEY), entry]);
        return Promise.resolve(entry);
      },
      update: (id, input) => {
        const updated: GuideEntry = {
          ...input,
          id,
          createdAt:
            read<GuideEntry>(GUIDE_KEY).find((g) => g.id === id)?.createdAt ??
            new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        write(
          GUIDE_KEY,
          read<GuideEntry>(GUIDE_KEY).map((g) => (g.id === id ? updated : g)),
        );
        return Promise.resolve(updated);
      },
      remove: (id) => {
        write(
          GUIDE_KEY,
          read<GuideEntry>(GUIDE_KEY).filter((g) => g.id !== id),
        );
        return Promise.resolve();
      },
    },
    products: {
      list: () => Promise.resolve({ data: read<UpsellProduct>(PRODUCTS_KEY), nextCursor: null }),
      get: (id) =>
        Promise.resolve(read<UpsellProduct>(PRODUCTS_KEY).find((p) => p.id === id) ?? null),
      create: (input) => {
        const product: UpsellProduct = {
          ...input,
          id: newId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        write(PRODUCTS_KEY, [...read<UpsellProduct>(PRODUCTS_KEY), product]);
        return Promise.resolve(product);
      },
      update: (id, input) => {
        const updated: UpsellProduct = {
          ...input,
          id,
          createdAt:
            read<UpsellProduct>(PRODUCTS_KEY).find((p) => p.id === id)?.createdAt ??
            new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        write(
          PRODUCTS_KEY,
          read<UpsellProduct>(PRODUCTS_KEY).map((p) => (p.id === id ? updated : p)),
        );
        return Promise.resolve(updated);
      },
      remove: (id) => {
        write(
          PRODUCTS_KEY,
          read<UpsellProduct>(PRODUCTS_KEY).filter((p) => p.id !== id),
        );
        return Promise.resolve();
      },
    },
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
