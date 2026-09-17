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
import type {
  OwnerOnboardingLink,
  OwnerOnboardingSubmission,
  OwnerOnboardingSubmissionInput,
} from "../../types/owner-onboarding";
import type { ProposalShareLink } from "../../types/proposal-share";
import type { OwnerNote } from "../../types/owner-note";

const TEMPLATES_KEY = "stayo-admin:checklist-templates";
const PROPOSALS_KEY = "stayo-admin:proposals";
const OWNER_LINKS_KEY = "stayo-admin:owner-onboarding-links";
const OWNER_SUBMISSIONS_KEY = "stayo-admin:owner-onboarding-submissions";
const PROPOSAL_SHARE_LINKS_KEY = "stayo-admin:proposal-share-links";
const OWNER_NOTES_KEY = "stayo-admin:owner-notes";

/** Exportadas para o mock de core-client.ts reaproveitar a mesma persistência para entidades que já existem no contrato do Core (guia, produtos) mas ainda não têm escrita real. */
export function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function write<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function newId(): EntityId {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

export const checklistTemplatesStore = {
  list: async (): Promise<ChecklistTemplateItem[]> =>
    read<ChecklistTemplateItem>(TEMPLATES_KEY).sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.phase.localeCompare(b.phase) || a.order - b.order,
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

  /** Busca uma versão específica pelo próprio id — nunca "a mais recente". */
  get: async (proposalId: EntityId): Promise<Proposal | null> =>
    read<Proposal>(PROPOSALS_KEY).find((p) => p.id === proposalId) ?? null,

  /** Cada salvamento cria uma NOVA versão — nunca sobrescreve a anterior. */
  createVersion: async (implementationId: EntityId, items: ProposalItem[]): Promise<Proposal> => {
    const all = read<Proposal>(PROPOSALS_KEY);
    const versions = all.filter((p) => p.implementationId === implementationId);
    const proposal: Proposal = {
      id: newId(),
      implementationId,
      version: versions.reduce((max, p) => Math.max(max, p.version), 0) + 1,
      items,
      total: items.reduce((sum, i) => sum + i.total, 0),
      acceptedAt: null,
      acceptedName: null,
      createdAt: new Date().toISOString(),
    };
    write(PROPOSALS_KEY, [...all, proposal]);
    return proposal;
  },

  /** Marca a versão como aceita — não cria versão nova, só registra a aceitação. */
  accept: async (proposalId: EntityId, acceptedName: string): Promise<Proposal | null> => {
    const all = read<Proposal>(PROPOSALS_KEY);
    const target = all.find((p) => p.id === proposalId);
    if (!target) return null;
    const accepted: Proposal = {
      ...target,
      acceptedAt: new Date().toISOString(),
      acceptedName,
    };
    write(
      PROPOSALS_KEY,
      all.map((p) => (p.id === proposalId ? accepted : p)),
    );
    return accepted;
  },
};

export const proposalShareStore = {
  getLinkForProposal: async (proposalId: EntityId): Promise<ProposalShareLink | null> =>
    read<ProposalShareLink>(PROPOSAL_SHARE_LINKS_KEY).find((l) => l.proposalId === proposalId) ??
    null,

  /** Idempotente por versão — reaproveita o link já gerado para ESTA versão. */
  createLinkForProposal: async (
    proposalId: EntityId,
    implementationId: EntityId,
  ): Promise<ProposalShareLink> => {
    const all = read<ProposalShareLink>(PROPOSAL_SHARE_LINKS_KEY);
    const existing = all.find((l) => l.proposalId === proposalId);
    if (existing) return existing;
    const link: ProposalShareLink = {
      proposalId,
      implementationId,
      token: newId(),
      createdAt: new Date().toISOString(),
    };
    write(PROPOSAL_SHARE_LINKS_KEY, [...all, link]);
    return link;
  },

  findByToken: async (token: string): Promise<ProposalShareLink | null> =>
    read<ProposalShareLink>(PROPOSAL_SHARE_LINKS_KEY).find((l) => l.token === token) ?? null,
};

/**
 * Auto-cadastro do proprietário via link — não é autenticado (não existe
 * login ainda no Admin nem no Core). O token só evita adivinhação trivial
 * da implantação; não é controle de acesso de verdade.
 */
export const ownerOnboardingStore = {
  getLink: async (implementationId: EntityId): Promise<OwnerOnboardingLink | null> =>
    read<OwnerOnboardingLink>(OWNER_LINKS_KEY).find(
      (l) => l.implementationId === implementationId,
    ) ?? null,

  /** Idempotente: reaproveita o link existente em vez de invalidar o anterior. */
  createLink: async (implementationId: EntityId): Promise<OwnerOnboardingLink> => {
    const all = read<OwnerOnboardingLink>(OWNER_LINKS_KEY);
    const existing = all.find((l) => l.implementationId === implementationId);
    if (existing) return existing;
    const link: OwnerOnboardingLink = {
      implementationId,
      token: newId(),
      createdAt: new Date().toISOString(),
    };
    write(OWNER_LINKS_KEY, [...all, link]);
    return link;
  },

  findByToken: async (token: string): Promise<OwnerOnboardingLink | null> =>
    read<OwnerOnboardingLink>(OWNER_LINKS_KEY).find((l) => l.token === token) ?? null,

  getSubmission: async (implementationId: EntityId): Promise<OwnerOnboardingSubmission | null> =>
    read<OwnerOnboardingSubmission>(OWNER_SUBMISSIONS_KEY).find(
      (s) => s.implementationId === implementationId,
    ) ?? null,

  submit: async (
    implementationId: EntityId,
    input: OwnerOnboardingSubmissionInput,
  ): Promise<OwnerOnboardingSubmission> => {
    const submission: OwnerOnboardingSubmission = {
      implementationId,
      ...input,
      submittedAt: new Date().toISOString(),
    };
    const others = read<OwnerOnboardingSubmission>(OWNER_SUBMISSIONS_KEY).filter(
      (s) => s.implementationId !== implementationId,
    );
    write(OWNER_SUBMISSIONS_KEY, [...others, submission]);
    return submission;
  },
};

export const ownerNotesStore = {
  get: async (ownerId: EntityId): Promise<OwnerNote | null> =>
    read<OwnerNote>(OWNER_NOTES_KEY).find((n) => n.ownerId === ownerId) ?? null,

  save: async (ownerId: EntityId, content: string): Promise<OwnerNote> => {
    const note: OwnerNote = { ownerId, content, updatedAt: new Date().toISOString() };
    const others = read<OwnerNote>(OWNER_NOTES_KEY).filter((n) => n.ownerId !== ownerId);
    write(OWNER_NOTES_KEY, [...others, note]);
    return note;
  },
};

export function proposalItemTotal(item: {
  quantity: number;
  unitValue: number;
  discount: number;
}): number {
  return Math.max(0, item.quantity * item.unitValue - item.discount);
}
