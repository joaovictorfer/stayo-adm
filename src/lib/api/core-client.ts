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
  const baseUrl = import.meta.env['VITE_CORE_API_URL'] as string | undefined;
  const appToken = import.meta.env['VITE_CORE_APP_TOKEN'] as string | undefined;

  if (!baseUrl || !appToken) {
    return createMockCoreApiClient();
  }
  return createCoreApiClient({ baseUrl, appToken });
}
