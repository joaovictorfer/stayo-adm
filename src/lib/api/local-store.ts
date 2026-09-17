/**
 * Repositório local temporário.
 *
 * O Stayo Core v1 ainda não tem endpoints para templates de checklist nem
 * para versões de proposta. Até ter, estes dados ficam no navegador
 * (localStorage), mas atrás de funções assíncronas com a mesma forma que
 * o Core terá — quando os endpoints existirem, troca-se só este arquivo.
 *
 * Nenhuma tela lê localStorage diretamente.
 */

import type { EntityId, Proposal, ProposalItem } from "../../types/core";
import type {
  ChecklistTemplateItem,
  ChecklistTemplateItemInput,
} from "../../types/checklist-template";

const TEMPLATES_KEY = "stayo-admin:checklist-templates";
const PROPOSALS_KEY = "stayo-admin:proposals";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function newId(): EntityId {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

export const checklistTemplatesStore = {
  list: async (): Promise<ChecklistTemplateItem[]> =>
    read<ChecklistTemplateItem>(TEMPLATES_KEY).sort(
      (a, b) =>
        a.category.localeCompare(b.category) ||
        a.phase.localeCompare(b.phase) ||
        a.order - b.order,
    ),

  create: async (input: ChecklistTemplateItemInput): Promise<ChecklistTemplateItem> => {
    const item: ChecklistTemplateItem = { ...input, id: newId() };
    write(TEMPLATES_KEY, [...read<ChecklistTemplateItem>(TEMPLATES_KEY), item]);
    return item;
  },

  update: async (
    id: EntityId,
    input: ChecklistTemplateItemInput,
  ): Promise<ChecklistTemplateItem> => {
    const updated: ChecklistTemplateItem = { ...input, id };
    write(
      TEMPLATES_KEY,
      read<ChecklistTemplateItem>(TEMPLATES_KEY).map((i) => (i.id === id ? updated : i)),
    );
    return updated;
  },

  remove: async (id: EntityId): Promise<void> => {
    write(
      TEMPLATES_KEY,
      read<ChecklistTemplateItem>(TEMPLATES_KEY).filter((i) => i.id !== id),
    );
  },
};

export const proposalsStore = {
  listAll: async (): Promise<Proposal[]> =>
    read<Proposal>(PROPOSALS_KEY).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  list: async (implementationId: EntityId): Promise<Proposal[]> =>
    read<Proposal>(PROPOSALS_KEY)
      .filter((p) => p.implementationId === implementationId)
      .sort((a, b) => b.version - a.version),

  /** Cada salvamento cria uma NOVA versão — nunca sobrescreve a anterior. */
  createVersion: async (
    implementationId: EntityId,
    items: ProposalItem[],
  ): Promise<Proposal> => {
    const all = read<Proposal>(PROPOSALS_KEY);
    const versions = all.filter((p) => p.implementationId === implementationId);
    const proposal: Proposal = {
      id: newId(),
      implementationId,
      version: versions.reduce((max, p) => Math.max(max, p.version), 0) + 1,
      items,
      total: items.reduce((sum, i) => sum + i.total, 0),
      acceptedAt: null,
      createdAt: new Date().toISOString(),
    };
    write(PROPOSALS_KEY, [...all, proposal]);
    return proposal;
  },
};

export function proposalItemTotal(item: {
  quantity: number;
  unitValue: number;
  discount: number;
}): number {
  return Math.max(0, item.quantity * item.unitValue - item.discount);
}
