/**
 * Adapter local MOCK/DEV do Stayo Core.
 *
 * Este é o único módulo do Core autorizado a conhecer o armazenamento local.
 * Não representa uma API real e não deve ser importado por telas.
 */
import type {
  Property, Condominium, Reservation, Guest, Owner, Inspection, OperationTask,
  Conversation, ConversationMessage, Contract, ImplementationProject,
  ImplementationItem, Proposal, EntityId, GuideEntry, UpsellProduct, Expense,
  Payout, ServiceInvoice, ServiceProvider, Settlement,
} from "../../types/core";
import type { ConsumerApp, CoreLogEntry, CoreOverview, CoreScope, CoreWebhook } from "../../types/core-admin";
import type { CoreClient, Page } from "./core-client";
import { checklistTemplatesStore, newId, read, write } from "./local-store";
import { nextImplementationCode } from "../implementation-status";

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

function createLocalClient(): CoreClient {
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

export const LocalCoreAdapter = {
  kind: "local-mock-dev" as const,
  create(): CoreClient {
    return createLocalClient();
  },
};
