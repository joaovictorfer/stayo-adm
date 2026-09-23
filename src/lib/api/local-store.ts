/**
 * Repositório local temporário.
 *
 * Checklist, links legados de proposta e notas ainda usam localStorage.
 * Propostas, porém, já têm schema real no Supabase e são parte crítica da
 * jornada do proprietário; quando o Supabase está configurado elas passam a
 * ser persistidas no banco. O conteúdo local antigo é promovido de forma
 * idempotente, sem ser apagado, para não perder versões criadas antes desta
 * transição.
 */

import type { EntityId, Proposal, ProposalItem } from "../../types/core";
import type {
  ChecklistTemplateItem,
  ChecklistTemplateItemInput,
} from "../../types/checklist-template";
import type { ProposalShareLink } from "../../types/proposal-share";
import type { OwnerNote } from "../../types/owner-note";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "./supabase-client";

const TEMPLATES_KEY = "stayo-admin:checklist-templates";
const PROPOSALS_KEY = "stayo-admin:proposals";
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

type ProposalRow = {
  id: string;
  implementation_id: string;
  version: number;
  items: ProposalItem[];
  total: number | string;
  accepted_at: string | null;
  accepted_name: string | null;
  created_at: string;
};

function proposalFromRow(row: ProposalRow): Proposal {
  return {
    id: row.id,
    implementationId: row.implementation_id,
    version: row.version,
    items: row.items,
    total: Number(row.total),
    acceptedAt: row.accepted_at,
    acceptedName: row.accepted_name,
    createdAt: row.created_at,
  };
}

function proposalClient() {
  return isSupabaseConfigured() ? getSupabaseBrowserClient() : null;
}

let localProposalMigration: Promise<void> | null = null;

/**
 * Promove as versões antigas do navegador para a tabela real sem apagar a
 * origem. A chave lógica (implantação + versão) vence em caso de colisão:
 * nunca sobrescrevemos uma versão que já exista no banco.
 */
async function ensureLocalProposalsMigrated(): Promise<void> {
  const supabase = proposalClient();
  if (!supabase || typeof window === "undefined") return;
  if (localProposalMigration) return localProposalMigration;

  localProposalMigration = (async () => {
    const local = read<Proposal>(PROPOSALS_KEY);
    if (local.length === 0) return;

    const { data: remote, error: remoteError } = await supabase
      .from("proposals")
      .select("id,implementation_id,version");
    if (remoteError) return;

    const remoteIds = new Set((remote ?? []).map((row) => row.id));
    const remoteVersions = new Set(
      (remote ?? []).map((row) => `${row.implementation_id}:${row.version}`),
    );
    const missing = local.filter(
      (proposal) =>
        !remoteIds.has(proposal.id) &&
        !remoteVersions.has(`${proposal.implementationId}:${proposal.version}`),
    );
    if (missing.length === 0) return;

    const { error } = await supabase.from("proposals").insert(
      missing.map((proposal) => ({
        id: proposal.id,
        implementation_id: proposal.implementationId,
        version: proposal.version,
        items: proposal.items,
        total: proposal.total,
        accepted_at: proposal.acceptedAt,
        accepted_name: proposal.acceptedName,
        created_at: proposal.createdAt,
      })),
    );
    if (error && error.code !== "23505") throw error;
  })().catch((error) => {
    // Permite uma nova tentativa numa próxima leitura sem transformar uma
    // falha transitória de migração em fallback silencioso permanente.
    localProposalMigration = null;
    throw error;
  });

  return localProposalMigration;
}

const localProposalsStore = {
  listAll: async (): Promise<Proposal[]> =>
    read<Proposal>(PROPOSALS_KEY).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  list: async (implementationId: EntityId): Promise<Proposal[]> =>
    read<Proposal>(PROPOSALS_KEY)
      .filter((p) => p.implementationId === implementationId)
      .sort((a, b) => b.version - a.version),

  get: async (proposalId: EntityId): Promise<Proposal | null> =>
    read<Proposal>(PROPOSALS_KEY).find((p) => p.id === proposalId) ?? null,

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

  accept: async (proposalId: EntityId, acceptedName: string): Promise<Proposal | null> => {
    const all = read<Proposal>(PROPOSALS_KEY);
    const target = all.find((p) => p.id === proposalId);
    if (!target) return null;
    const accepted: Proposal = {
      ...target,
      acceptedAt: target.acceptedAt ?? new Date().toISOString(),
      acceptedName: target.acceptedName ?? acceptedName,
    };
    write(
      PROPOSALS_KEY,
      all.map((p) => (p.id === proposalId ? accepted : p)),
    );
    return accepted;
  },
};

export const proposalsStore = {
  listAll: async (): Promise<Proposal[]> => {
    const supabase = proposalClient();
    if (!supabase) return localProposalsStore.listAll();
    await ensureLocalProposalsMigrated();
    const { data, error } = await supabase
      .from("proposals")
      .select()
      .order("created_at", { ascending: false })
      .returns<ProposalRow[]>();
    if (error) throw error;
    return data.map(proposalFromRow);
  },

  list: async (implementationId: EntityId): Promise<Proposal[]> => {
    const supabase = proposalClient();
    if (!supabase) return localProposalsStore.list(implementationId);
    await ensureLocalProposalsMigrated();
    const { data, error } = await supabase
      .from("proposals")
      .select()
      .eq("implementation_id", implementationId)
      .order("version", { ascending: false })
      .returns<ProposalRow[]>();
    if (error) throw error;
    return data.map(proposalFromRow);
  },

  get: async (proposalId: EntityId): Promise<Proposal | null> => {
    const supabase = proposalClient();
    if (!supabase) return localProposalsStore.get(proposalId);
    await ensureLocalProposalsMigrated();
    const { data, error } = await supabase
      .from("proposals")
      .select()
      .eq("id", proposalId)
      .maybeSingle<ProposalRow>();
    if (error) throw error;
    return data ? proposalFromRow(data) : null;
  },

  /** Cada salvamento cria uma NOVA versão — nunca sobrescreve a anterior. */
  createVersion: async (implementationId: EntityId, items: ProposalItem[]): Promise<Proposal> => {
    const supabase = proposalClient();
    if (!supabase) return localProposalsStore.createVersion(implementationId, items);
    await ensureLocalProposalsMigrated();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: latest, error: latestError } = await supabase
        .from("proposals")
        .select("version")
        .eq("implementation_id", implementationId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle<{ version: number }>();
      if (latestError) throw latestError;

      const row = {
        id: newId(),
        implementation_id: implementationId,
        version: (latest?.version ?? 0) + 1,
        items,
        total: items.reduce((sum, item) => sum + item.total, 0),
      };
      const { data, error } = await supabase
        .from("proposals")
        .insert(row)
        .select()
        .single<ProposalRow>();
      if (!error) return proposalFromRow(data);
      if (error.code !== "23505") throw error;
    }

    throw new Error("Não foi possível criar uma nova versão da proposta após várias tentativas.");
  },

  /** Aceite administrativo/legado; no novo onboarding público o aceite passa por RPC com o token. */
  accept: async (proposalId: EntityId, acceptedName: string): Promise<Proposal | null> => {
    const supabase = proposalClient();
    if (!supabase) return localProposalsStore.accept(proposalId, acceptedName);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("proposals")
      .update({ accepted_at: now, accepted_name: acceptedName })
      .eq("id", proposalId)
      .is("accepted_at", null)
      .select()
      .maybeSingle<ProposalRow>();
    if (error) throw error;
    if (data) return proposalFromRow(data);

    const { data: existing, error: existingError } = await supabase
      .from("proposals")
      .select()
      .eq("id", proposalId)
      .maybeSingle<ProposalRow>();
    if (existingError) throw existingError;
    return existing ? proposalFromRow(existing) : null;
  },
};

export const proposalShareStore = {
  getLinkForProposal: async (proposalId: EntityId): Promise<ProposalShareLink | null> =>
    read<ProposalShareLink>(PROPOSAL_SHARE_LINKS_KEY).find((l) => l.proposalId === proposalId) ??
    null,

  /**
   * Link legado de prévia de proposta. A jornada oficial do proprietário usa
   * o convite único de onboarding e não depende mais deste token separado.
   */
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

// O convite/envio de auto-cadastro do proprietário (antes `ownerOnboardingStore`
// aqui) foi promovido a `adminApi.ownerOnboarding` (Fase 16) — ver
// src/lib/api/admin-client.ts e docs/OWNER_ONBOARDING_ARCHITECTURE.md.

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
