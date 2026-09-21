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
 * estiver no ar, troca-se apenas o adapter no ponto de composição — nenhum
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

export interface CoreClient {
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

import { LocalCoreAdapter } from "./local-core-adapter";
import { HttpCoreAdapter } from "./http-core-adapter";

/** Compatibilidade nominal enquanto consumidores antigos migram para CoreClient. */
export type CoreApiClient = CoreClient;

/** Adapter local de desenvolvimento. Nenhuma tela conhece seu armazenamento. */
export function createMockCoreApiClient(): CoreClient {
  return LocalCoreAdapter.create();
}

/**
 * Reserva o ponto de construção do adapter HTTP sem definir endpoints antes do
 * contrato oficial do Stayo Core existir.
 */
export function createCoreApiClient(config: CoreApiConfig): CoreClient {
  return new HttpCoreAdapter(config).createClient();
}

/** Ponto único de composição. Até o Core v1 existir, usa somente o adapter local. */
export function createDefaultCoreApiClient(): CoreClient {
  return LocalCoreAdapter.create();
}

