/**
 * Camada de acesso ao domínio PRÓPRIO do Stayo Admin (Grupo A — ver
 * docs/OWNER_IMPLEMENTATION_AUDIT.md §4 e §6).
 *
 * Mesmo princípio do `core-client.ts`: nenhuma tela decide mock-vs-real.
 * `createDefaultAdminApiClient()` escolhe o adapter Supabase quando
 * `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` existem, e cai para o
 * adapter local (localStorage) enquanto não existirem — exatamente o
 * blocker de credencial externa descrito na Fase 0: não bloqueia o
 * projeto, só troca de adapter quando a credencial chegar.
 *
 * Este contrato cresce fase a fase (ver docs/OWNER_IMPLEMENTATION_AUDIT.md
 * §6 e as Fases 2–10 do plano): auditoria (Fase 1) e proprietário (Fase 2)
 * até aqui.
 */

import type { AuditEvent, AuditLogEntry, AuditLogInput } from "../../types/audit";
import type {
  CommercialTerm,
  CommercialTermDefault,
  CommercialTermDefaultInput,
  InitialCharge,
  InitialChargeItem,
  InitialChargeStatus,
  OutboundMessage,
  OutboundMessageInput,
  OwnerRecord,
  OwnerRecordInput,
  OwnerTask,
  OwnerTaskInput,
  OwnerTaskStatus,
} from "../../types/admin";
import type {
  OwnerOnboardingLink,
  OwnerOnboardingSubmission,
  OwnerOnboardingSubmissionInput,
} from "../../types/owner-onboarding";
import { constraintTargetsColumn, isUniqueViolation, nextSequentialCode } from "../sequential-code";
import { hashToken } from "./token-hash";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "./supabase-client";
import { newId, read, write } from "./local-store";

export interface AdminApiClient {
  audit: {
    log(input: AuditLogInput): Promise<AuditLogEntry>;
    list(params?: { entityType?: string; entityId?: string }): Promise<AuditLogEntry[]>;
  };
  owners: {
    list(params?: { q?: string }): Promise<OwnerRecord[]>;
    get(id: string): Promise<OwnerRecord | null>;
    create(input: OwnerRecordInput): Promise<OwnerRecord>;
    update(id: string, patch: Partial<Omit<OwnerRecord, "id" | "createdAt">>): Promise<OwnerRecord>;
    /** Dedupe simples por telefone — usado pelo cadastro rápido da Nova Implantação. */
    findOrCreateByPhone(input: OwnerRecordInput): Promise<OwnerRecord>;
  };
  commercialTermDefaults: {
    list(): Promise<CommercialTermDefault[]>;
    create(input: CommercialTermDefaultInput): Promise<CommercialTermDefault>;
    update(id: string, input: CommercialTermDefaultInput): Promise<CommercialTermDefault>;
    remove(id: string): Promise<void>;
  };
  commercialTerms: {
    listByImplementation(implementationId: string): Promise<CommercialTerm[]>;
    /** Clona os defaults vigentes para a implantação — idempotente. */
    cloneDefaults(implementationId: string): Promise<CommercialTerm[]>;
    update(
      id: string,
      patch: Partial<Omit<CommercialTerm, "id" | "implementationId">>,
    ): Promise<CommercialTerm>;
  };
  outbox: {
    listByImplementation(implementationId: string): Promise<OutboundMessage[]>;
    /** Sempre nasce "queued" — o envio de verdade depende do gateway (mock hoje). */
    enqueue(input: OutboundMessageInput): Promise<OutboundMessage>;
    markSent(id: string, providerMessageId: string | null): Promise<OutboundMessage>;
    markFailed(id: string, error: string): Promise<OutboundMessage>;
  };
  initialCharges: {
    listByImplementation(implementationId: string): Promise<InitialCharge[]>;
    /** Idempotente por proposalId — aceitar a mesma versão duas vezes não duplica cobrança. */
    createFromProposal(input: {
      implementationId: string;
      ownerId: string | null;
      proposalId: string;
      items: InitialChargeItem[];
    }): Promise<InitialCharge>;
    updateStatus(
      id: string,
      status: InitialChargeStatus,
      patch?: { paymentReference?: string | null; paidAt?: string | null },
    ): Promise<InitialCharge>;
  };
  ownerTasks: {
    listByOwner(ownerId: string): Promise<OwnerTask[]>;
    create(input: OwnerTaskInput): Promise<OwnerTask>;
    /** Só o time interno chama isto — nunca o proprietário sob a própria sessão (RLS não tem policy de escrita para ele). */
    updateStatus(id: string, status: OwnerTaskStatus): Promise<OwnerTask>;
  };
  ownerOnboarding: {
    /** Convite mais recente desta implantação, qualquer que seja o status. */
    getLink(implementationId: string): Promise<OwnerOnboardingLink | null>;
    /**
     * Sempre cria um convite novo, revogando qualquer um ainda ativo da
     * mesma implantação. `ownerId` fica gravado no convite (Fase 17H) —
     * é o que permite `owner_account_link` vincular a conta do
     * proprietário ao `owner_id` certo sem depender do adapter de
     * `implementation_projects`.
     */
    createLink(
      implementationId: string,
      ownerId: string | null,
      validityDays?: number,
    ): Promise<{ link: OwnerOnboardingLink; token: string }>;
    revoke(id: string): Promise<OwnerOnboardingLink>;
    /**
     * Chamado pelo portal público (sem autenticação) — nunca lê a tabela
     * diretamente sob RLS; no adapter Supabase, resolve via função
     * security-definer (ver migration 0007).
     */
    findByToken(token: string): Promise<OwnerOnboardingLink | null>;
    getSubmission(implementationId: string): Promise<OwnerOnboardingSubmission | null>;
    getDraft(token: string): Promise<OwnerOnboardingSubmission | null>;
    saveDraft(token: string, input: OwnerOnboardingSubmissionInput, currentStep: number, submit?: boolean): Promise<OwnerOnboardingSubmission>;
    /** Idem — chamado pelo portal público, valida tudo de novo server-side. */
    submit(
      implementationId: string,
      token: string,
      input: OwnerOnboardingSubmissionInput,
    ): Promise<OwnerOnboardingSubmission>;
  };
}

// Exportadas para o importador de migração (src/lib/migration/local-to-supabase.ts)
// reusar a mesma chave em vez de duplicar a string em outro arquivo.
export const AUDIT_LOGS_KEY = "stayo-admin:audit-logs";
export const OWNER_RECORDS_KEY = "stayo-admin:owner-records";
export const COMMERCIAL_TERM_DEFAULTS_KEY = "stayo-admin:commercial-term-defaults";
export const COMMERCIAL_TERMS_KEY = "stayo-admin:commercial-terms";
export const INITIAL_CHARGES_KEY = "stayo-admin:initial-charges";
export const OUTBOUND_MESSAGES_KEY = "stayo-admin:outbound-messages";
export const OWNER_ONBOARDING_LINKS_KEY = "stayo-admin:owner-onboarding-links";
export const OWNER_ONBOARDING_SUBMISSIONS_KEY = "stayo-admin:owner-onboarding-submissions";
export const OWNER_TASKS_KEY = "stayo-admin:owner-tasks";

const DEFAULT_INVITATION_VALIDITY_DAYS = 7;

/** Adapter local — usado enquanto não há credencial Supabase configurada. */
export function createLocalAdminApiClient(): AdminApiClient {
  const audit: AdminApiClient["audit"] = {
    log: (input) => {
      const entry: AuditLogEntry = {
        ...input,
        id: newId(),
        createdAt: new Date().toISOString(),
      };
      write(AUDIT_LOGS_KEY, [...read<AuditLogEntry>(AUDIT_LOGS_KEY), entry]);
      return Promise.resolve(entry);
    },
    list: (params) => {
      let entries = read<AuditLogEntry>(AUDIT_LOGS_KEY);
      if (params?.entityType) {
        entries = entries.filter((e) => e.entityType === params.entityType);
      }
      if (params?.entityId) {
        entries = entries.filter((e) => e.entityId === params.entityId);
      }
      return Promise.resolve([...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
  };

  const owners: AdminApiClient["owners"] = {
    list: (params) => {
      const all = read<OwnerRecord>(OWNER_RECORDS_KEY);
      const term = params?.q?.trim().toLowerCase();
      const filtered = term
        ? all.filter((o) => o.name.toLowerCase().includes(term) || (o.phone ?? "").includes(term))
        : all;
      return Promise.resolve([...filtered].sort((a, b) => a.name.localeCompare(b.name)));
    },
    get: (id) =>
      Promise.resolve(read<OwnerRecord>(OWNER_RECORDS_KEY).find((o) => o.id === id) ?? null),
    create: async (input) => {
      const owner: OwnerRecord = {
        id: newId(),
        name: input.name,
        phone: input.phone,
        email: input.email,
        document: input.document ?? null,
        lifecycleStatus: "prospect",
        coreOwnerId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      write(OWNER_RECORDS_KEY, [...read<OwnerRecord>(OWNER_RECORDS_KEY), owner]);
      await audit.log({
        actorId: null,
        event: "owner.created",
        entityType: "owner",
        entityId: owner.id,
        metadata: { name: owner.name },
      });
      return owner;
    },
    update: async (id, patch) => {
      const all = read<OwnerRecord>(OWNER_RECORDS_KEY);
      const target = all.find((o) => o.id === id);
      if (!target) throw new Error("Proprietário não encontrado");
      const updated: OwnerRecord = { ...target, ...patch, updatedAt: new Date().toISOString() };
      write(
        OWNER_RECORDS_KEY,
        all.map((o) => (o.id === id ? updated : o)),
      );
      await audit.log({
        actorId: null,
        event: "owner.updated",
        entityType: "owner",
        entityId: id,
        metadata: { patch },
      });
      return updated;
    },
    findOrCreateByPhone: async (input) => {
      const phone = input.phone?.trim();
      const existing = phone
        ? read<OwnerRecord>(OWNER_RECORDS_KEY).find((o) => o.phone?.trim() === phone)
        : undefined;
      if (existing) return existing;
      return owners.create(input);
    },
  };

  const commercialTermDefaults: AdminApiClient["commercialTermDefaults"] = {
    list: () =>
      Promise.resolve(
        [...read<CommercialTermDefault>(COMMERCIAL_TERM_DEFAULTS_KEY)].sort(
          (a, b) => a.displayOrder - b.displayOrder,
        ),
      ),
    create: (input) => {
      const item: CommercialTermDefault = { ...input, id: newId() };
      write(COMMERCIAL_TERM_DEFAULTS_KEY, [
        ...read<CommercialTermDefault>(COMMERCIAL_TERM_DEFAULTS_KEY),
        item,
      ]);
      return Promise.resolve(item);
    },
    update: (id, input) => {
      const updated: CommercialTermDefault = { ...input, id };
      write(
        COMMERCIAL_TERM_DEFAULTS_KEY,
        read<CommercialTermDefault>(COMMERCIAL_TERM_DEFAULTS_KEY).map((i) =>
          i.id === id ? updated : i,
        ),
      );
      return Promise.resolve(updated);
    },
    remove: (id) => {
      write(
        COMMERCIAL_TERM_DEFAULTS_KEY,
        read<CommercialTermDefault>(COMMERCIAL_TERM_DEFAULTS_KEY).filter((i) => i.id !== id),
      );
      return Promise.resolve();
    },
  };

  const commercialTerms: AdminApiClient["commercialTerms"] = {
    listByImplementation: (implementationId) =>
      Promise.resolve(
        read<CommercialTerm>(COMMERCIAL_TERMS_KEY)
          .filter((t) => t.implementationId === implementationId)
          .sort((a, b) => a.displayOrder - b.displayOrder),
      ),
    cloneDefaults: async (implementationId) => {
      const existing = read<CommercialTerm>(COMMERCIAL_TERMS_KEY).filter(
        (t) => t.implementationId === implementationId,
      );
      if (existing.length > 0) return existing;
      const defaults = await commercialTermDefaults.list();
      const cloned: CommercialTerm[] = defaults.map((d) => ({
        id: newId(),
        implementationId,
        label: d.label,
        chargeType: d.chargeType,
        value: d.value,
        optional: d.optional,
        displayOrder: d.displayOrder,
        notes: d.notes,
      }));
      write(COMMERCIAL_TERMS_KEY, [...read<CommercialTerm>(COMMERCIAL_TERMS_KEY), ...cloned]);
      return cloned;
    },
    update: async (id, patch) => {
      const all = read<CommercialTerm>(COMMERCIAL_TERMS_KEY);
      const target = all.find((t) => t.id === id);
      if (!target) throw new Error("Condição comercial não encontrada");
      const updated: CommercialTerm = { ...target, ...patch };
      write(
        COMMERCIAL_TERMS_KEY,
        all.map((t) => (t.id === id ? updated : t)),
      );
      return Promise.resolve(updated);
    },
  };

  const outbox: AdminApiClient["outbox"] = {
    listByImplementation: (implementationId) =>
      Promise.resolve(
        [...read<OutboundMessage>(OUTBOUND_MESSAGES_KEY)]
          .filter((m) => m.implementationId === implementationId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
    enqueue: (input) => {
      const message: OutboundMessage = {
        ...input,
        id: newId(),
        status: "queued",
        providerMessageId: null,
        error: null,
        createdAt: new Date().toISOString(),
        sentAt: null,
        failedAt: null,
      };
      write(OUTBOUND_MESSAGES_KEY, [...read<OutboundMessage>(OUTBOUND_MESSAGES_KEY), message]);
      return Promise.resolve(message);
    },
    markSent: (id, providerMessageId) => {
      const all = read<OutboundMessage>(OUTBOUND_MESSAGES_KEY);
      const target = all.find((m) => m.id === id);
      if (!target) return Promise.reject(new Error("Mensagem não encontrada"));
      const updated: OutboundMessage = {
        ...target,
        status: "sent",
        providerMessageId,
        sentAt: new Date().toISOString(),
      };
      write(
        OUTBOUND_MESSAGES_KEY,
        all.map((m) => (m.id === id ? updated : m)),
      );
      return Promise.resolve(updated);
    },
    markFailed: (id, error) => {
      const all = read<OutboundMessage>(OUTBOUND_MESSAGES_KEY);
      const target = all.find((m) => m.id === id);
      if (!target) return Promise.reject(new Error("Mensagem não encontrada"));
      const updated: OutboundMessage = {
        ...target,
        status: "failed",
        error,
        failedAt: new Date().toISOString(),
      };
      write(
        OUTBOUND_MESSAGES_KEY,
        all.map((m) => (m.id === id ? updated : m)),
      );
      return Promise.resolve(updated);
    },
  };

  const initialCharges: AdminApiClient["initialCharges"] = {
    listByImplementation: (implementationId) =>
      Promise.resolve(
        [...read<InitialCharge>(INITIAL_CHARGES_KEY)]
          .filter((c) => c.implementationId === implementationId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
    createFromProposal: async (input) => {
      const all = read<InitialCharge>(INITIAL_CHARGES_KEY);
      const existing = all.find((c) => c.proposalId === input.proposalId);
      if (existing) return existing;
      const charge: InitialCharge = {
        id: newId(),
        code: nextSequentialCode(
          "COB",
          all.map((c) => c.code),
        ),
        implementationId: input.implementationId,
        ownerId: input.ownerId,
        proposalId: input.proposalId,
        items: input.items,
        amount: input.items.reduce((sum, i) => sum + i.amount, 0),
        status: "pending",
        dueAt: null,
        paymentReference: null,
        paidAt: null,
        notes: null,
        createdAt: new Date().toISOString(),
      };
      write(INITIAL_CHARGES_KEY, [...all, charge]);
      await audit.log({
        actorId: null,
        event: "charge.created",
        entityType: "initial_charge",
        entityId: charge.id,
        metadata: { implementationId: input.implementationId, amount: charge.amount },
      });
      return charge;
    },
    updateStatus: async (id, status, patch) => {
      const all = read<InitialCharge>(INITIAL_CHARGES_KEY);
      const target = all.find((c) => c.id === id);
      if (!target) throw new Error("Cobrança não encontrada");
      const updated: InitialCharge = {
        ...target,
        status,
        paymentReference: patch?.paymentReference ?? target.paymentReference,
        paidAt: status === "paid" ? (patch?.paidAt ?? new Date().toISOString()) : target.paidAt,
      };
      write(
        INITIAL_CHARGES_KEY,
        all.map((c) => (c.id === id ? updated : c)),
      );
      await audit.log({
        actorId: null,
        event: "charge.status_changed",
        entityType: "initial_charge",
        entityId: id,
        metadata: { from: target.status, to: status },
      });
      return updated;
    },
  };

  const ownerOnboarding: AdminApiClient["ownerOnboarding"] = {
    getLink: async (implementationId) => {
      const links = read<OwnerOnboardingLink>(OWNER_ONBOARDING_LINKS_KEY)
        .filter((l) => l.implementationId === implementationId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return links[0] ?? null;
    },
    createLink: async (
      implementationId,
      ownerId,
      validityDays = DEFAULT_INVITATION_VALIDITY_DAYS,
    ) => {
      const now = new Date();
      const existing = read<OwnerOnboardingLink>(OWNER_ONBOARDING_LINKS_KEY);
      const stillActive = existing.filter(
        (l) => l.implementationId === implementationId && !l.revokedAt && !l.usedAt,
      );

      const token = newId();
      const tokenHash = await hashToken(token);
      const link: OwnerOnboardingLink = {
        id: newId(),
        implementationId,
        ownerId,
        tokenHash,
        createdAt: now.toISOString(),
        createdBy: null,
        expiresAt: new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString(),
        usedAt: null,
        revokedAt: null,
        lastAccessAt: null,
      };

      const revokedIds = new Set(stillActive.map((l) => l.id));
      write(OWNER_ONBOARDING_LINKS_KEY, [
        ...existing.map((l) => (revokedIds.has(l.id) ? { ...l, revokedAt: now.toISOString() } : l)),
        link,
      ]);
      await audit.log({
        actorId: null,
        event: "portal.invitation_created",
        entityType: "implementation",
        entityId: implementationId,
        metadata: {},
      });
      return { link, token };
    },
    revoke: async (id) => {
      const all = read<OwnerOnboardingLink>(OWNER_ONBOARDING_LINKS_KEY);
      const target = all.find((l) => l.id === id);
      if (!target) throw new Error("Convite não encontrado");
      const updated: OwnerOnboardingLink = { ...target, revokedAt: new Date().toISOString() };
      write(
        OWNER_ONBOARDING_LINKS_KEY,
        all.map((l) => (l.id === id ? updated : l)),
      );
      await audit.log({
        actorId: null,
        event: "portal.invitation_revoked",
        entityType: "implementation",
        entityId: target.implementationId,
        metadata: {},
      });
      return updated;
    },
    findByToken: async (token) => {
      const tokenHash = await hashToken(token);
      return (
        read<OwnerOnboardingLink>(OWNER_ONBOARDING_LINKS_KEY).find(
          (l) => l.tokenHash === tokenHash,
        ) ?? null
      );
    },
    getSubmission: async (implementationId) =>
      read<OwnerOnboardingSubmission>(OWNER_ONBOARDING_SUBMISSIONS_KEY).find(
        (s) => s.implementationId === implementationId,
      ) ?? null,
    getDraft: async (token) => {
      const link = await ownerOnboarding.findByToken(token);
      return link ? ownerOnboarding.getSubmission(link.implementationId) : null;
    },
    saveDraft: async (token, input, currentStep, submit = false) => {
      const link = await ownerOnboarding.findByToken(token);
      if (!link) throw new Error("Convite não encontrado");
      const submission: OwnerOnboardingSubmission = {
        implementationId: link.implementationId,
        ...input,
        currentStep,
        submittedAt: submit ? new Date().toISOString() : null,
      };
      const others = read<OwnerOnboardingSubmission>(OWNER_ONBOARDING_SUBMISSIONS_KEY).filter((item) => item.implementationId !== link.implementationId);
      write(OWNER_ONBOARDING_SUBMISSIONS_KEY, [...others, submission]);
      return submission;
    },
    submit: async (implementationId, _token, input) => {
      const activeLink = await ownerOnboarding.getLink(implementationId);
      if (activeLink && !activeLink.usedAt) {
        const links = read<OwnerOnboardingLink>(OWNER_ONBOARDING_LINKS_KEY);
        write(
          OWNER_ONBOARDING_LINKS_KEY,
          links.map((l) =>
            l.id === activeLink.id ? { ...l, usedAt: new Date().toISOString() } : l,
          ),
        );
      }
      const submission: OwnerOnboardingSubmission = {
        implementationId,
        ...input,
        currentStep: 5,
        submittedAt: new Date().toISOString(),
      };
      const others = read<OwnerOnboardingSubmission>(OWNER_ONBOARDING_SUBMISSIONS_KEY).filter(
        (s) => s.implementationId !== implementationId,
      );
      write(OWNER_ONBOARDING_SUBMISSIONS_KEY, [...others, submission]);
      await audit.log({
        actorId: null,
        event: "owner.data_submitted",
        entityType: "implementation",
        entityId: implementationId,
        metadata: {},
      });
      return submission;
    },
  };

  const ownerTasks: AdminApiClient["ownerTasks"] = {
    listByOwner: (ownerId) =>
      Promise.resolve(
        [...read<OwnerTask>(OWNER_TASKS_KEY)]
          .filter((t) => t.ownerId === ownerId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
    create: async (input) => {
      const task: OwnerTask = {
        id: newId(),
        ownerId: input.ownerId,
        implementationId: input.implementationId,
        kind: input.kind,
        title: input.title,
        description: input.description,
        status: "pending",
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      write(OWNER_TASKS_KEY, [...read<OwnerTask>(OWNER_TASKS_KEY), task]);
      return task;
    },
    updateStatus: async (id, status) => {
      const all = read<OwnerTask>(OWNER_TASKS_KEY);
      const target = all.find((t) => t.id === id);
      if (!target) throw new Error("Pendência não encontrada");
      const updated: OwnerTask = {
        ...target,
        status,
        completedAt: status === "done" ? new Date().toISOString() : null,
      };
      write(
        OWNER_TASKS_KEY,
        all.map((t) => (t.id === id ? updated : t)),
      );
      return updated;
    },
  };

  return {
    audit,
    owners,
    commercialTermDefaults,
    commercialTerms,
    outbox,
    initialCharges,
    ownerOnboarding,
    ownerTasks,
  };
}

interface AuditLogRow {
  id: string;
  actor_id: string | null;
  event: AuditEvent;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

function auditFromRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    event: row.event,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

interface OwnerRecordRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  lifecycle_status: OwnerRecord["lifecycleStatus"];
  core_owner_id: string | null;
  created_at: string;
  updated_at: string;
}

function ownerFromRow(row: OwnerRecordRow): OwnerRecord {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    document: row.document,
    lifecycleStatus: row.lifecycle_status,
    coreOwnerId: row.core_owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface CommercialTermDefaultRow {
  id: string;
  label: string;
  charge_type: CommercialTermDefault["chargeType"];
  value: number;
  optional: boolean;
  display_order: number;
  notes: string | null;
}

function defaultFromRow(row: CommercialTermDefaultRow): CommercialTermDefault {
  return {
    id: row.id,
    label: row.label,
    chargeType: row.charge_type,
    value: row.value,
    optional: row.optional,
    displayOrder: row.display_order,
    notes: row.notes,
  };
}

interface CommercialTermRow {
  id: string;
  implementation_id: string;
  label: string;
  charge_type: CommercialTerm["chargeType"];
  value: number;
  optional: boolean;
  display_order: number;
  notes: string | null;
}

function termFromRow(row: CommercialTermRow): CommercialTerm {
  return {
    id: row.id,
    implementationId: row.implementation_id,
    label: row.label,
    chargeType: row.charge_type,
    value: row.value,
    optional: row.optional,
    displayOrder: row.display_order,
    notes: row.notes,
  };
}

interface OutboundMessageRow {
  id: string;
  implementation_id: string;
  owner_id: string | null;
  destination: string;
  template: string;
  body: string;
  status: OutboundMessage["status"];
  provider_message_id: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
  failed_at: string | null;
}

function outboundMessageFromRow(row: OutboundMessageRow): OutboundMessage {
  return {
    id: row.id,
    implementationId: row.implementation_id,
    ownerId: row.owner_id,
    destination: row.destination,
    template: row.template,
    body: row.body,
    status: row.status,
    providerMessageId: row.provider_message_id,
    error: row.error,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    failedAt: row.failed_at,
  };
}

interface InitialChargeRow {
  id: string;
  code: string;
  implementation_id: string;
  owner_id: string | null;
  proposal_id: string;
  items: InitialChargeItem[];
  amount: number;
  status: InitialChargeStatus;
  due_at: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

function initialChargeFromRow(row: InitialChargeRow): InitialCharge {
  return {
    id: row.id,
    code: row.code,
    implementationId: row.implementation_id,
    ownerId: row.owner_id,
    proposalId: row.proposal_id,
    items: row.items,
    amount: row.amount,
    status: row.status,
    dueAt: row.due_at,
    paymentReference: row.payment_reference,
    paidAt: row.paid_at,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

interface OwnerOnboardingLinkRow {
  id: string;
  implementation_id: string;
  owner_id: string | null;
  token_hash: string;
  created_at: string;
  created_by: string | null;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  last_access_at: string | null;
}

function ownerOnboardingLinkFromRow(row: OwnerOnboardingLinkRow): OwnerOnboardingLink {
  return {
    id: row.id,
    implementationId: row.implementation_id,
    ownerId: row.owner_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    createdBy: row.created_by,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    revokedAt: row.revoked_at,
    lastAccessAt: row.last_access_at,
  };
}

interface OwnerTaskRow {
  id: string;
  owner_id: string;
  implementation_id: string | null;
  kind: string;
  title: string;
  description: string | null;
  status: OwnerTaskStatus;
  created_at: string;
  completed_at: string | null;
}

function ownerTaskFromRow(row: OwnerTaskRow): OwnerTask {
  return {
    id: row.id,
    ownerId: row.owner_id,
    implementationId: row.implementation_id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

interface OwnerOnboardingSubmissionRow {
  implementation_id: string;
  full_name: string;
  document: string | null;
  email: string;
  phone: string;
  pix_key: string | null;
  submitted_at: string;
}

function ownerOnboardingSubmissionFromRow(
  row: OwnerOnboardingSubmissionRow,
): OwnerOnboardingSubmission {
  return {
    implementationId: row.implementation_id,
    personType: "pf",
    fullName: row.full_name,
    document: row.document ?? "",
    email: row.email,
    phone: row.phone,
    postalCode: "",
    street: "",
    number: "",
    complement: null,
    district: "",
    city: "",
    state: "",
    bankName: "",
    accountHolder: row.full_name,
    holderTaxId: row.document ?? "",
    pixType: "random",
    pixKey: row.pix_key ?? "",
    isPrimary: true,
    currentStep: 5,
    submittedAt: row.submitted_at,
  };
}

/** Adapter real — requer projeto Supabase com as migrations 0001+0002 aplicadas. */
export function createSupabaseAdminApiClient(): AdminApiClient {
  const client = () => {
    const c = getSupabaseBrowserClient();
    if (!c) throw new Error("Supabase não configurado");
    return c;
  };

  const audit: AdminApiClient["audit"] = {
    log: async (input) => {
      const supabase = client();
      const { data: session } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("audit_logs")
        .insert({
          actor_id: session.user?.id ?? null,
          event: input.event,
          entity_type: input.entityType,
          entity_id: input.entityId,
          metadata: input.metadata,
        })
        .select()
        .single<AuditLogRow>();
      if (error) throw error;
      return auditFromRow(data);
    },
    list: async (params) => {
      const supabase = client();
      let query = supabase.from("audit_logs").select().order("created_at", { ascending: false });
      if (params?.entityType) query = query.eq("entity_type", params.entityType);
      if (params?.entityId) query = query.eq("entity_id", params.entityId);
      const { data, error } = await query.returns<AuditLogRow[]>();
      if (error) throw error;
      return data.map(auditFromRow);
    },
  };

  const owners: AdminApiClient["owners"] = {
    list: async (params) => {
      const supabase = client();
      let query = supabase.from("owner_records").select().order("name");
      if (params?.q) query = query.or(`name.ilike.%${params.q}%,phone.ilike.%${params.q}%`);
      const { data, error } = await query.returns<OwnerRecordRow[]>();
      if (error) throw error;
      return data.map(ownerFromRow);
    },
    get: async (id) => {
      const { data, error } = await client()
        .from("owner_records")
        .select()
        .eq("id", id)
        .maybeSingle<OwnerRecordRow>();
      if (error) throw error;
      return data ? ownerFromRow(data) : null;
    },
    create: async (input) => {
      const { data, error } = await client()
        .from("owner_records")
        .insert({
          name: input.name,
          phone: input.phone,
          email: input.email,
          document: input.document ?? null,
        })
        .select()
        .single<OwnerRecordRow>();
      if (error) throw error;
      return ownerFromRow(data);
    },
    update: async (id, patch) => {
      const { data, error } = await client()
        .from("owner_records")
        .update({
          name: patch.name,
          phone: patch.phone,
          email: patch.email,
          document: patch.document,
          lifecycle_status: patch.lifecycleStatus,
          core_owner_id: patch.coreOwnerId,
        })
        .eq("id", id)
        .select()
        .single<OwnerRecordRow>();
      if (error) throw error;
      return ownerFromRow(data);
    },
    findOrCreateByPhone: async (input) => {
      if (input.phone?.trim()) {
        const { data, error } = await client()
          .from("owner_records")
          .select()
          .eq("phone", input.phone.trim())
          .maybeSingle<OwnerRecordRow>();
        if (error) throw error;
        if (data) return ownerFromRow(data);
      }
      return owners.create(input);
    },
  };

  const commercialTermDefaults: AdminApiClient["commercialTermDefaults"] = {
    list: async () => {
      const { data, error } = await client()
        .from("commercial_term_defaults")
        .select()
        .order("display_order")
        .returns<CommercialTermDefaultRow[]>();
      if (error) throw error;
      return data.map(defaultFromRow);
    },
    create: async (input) => {
      const { data, error } = await client()
        .from("commercial_term_defaults")
        .insert({
          label: input.label,
          charge_type: input.chargeType,
          value: input.value,
          optional: input.optional,
          display_order: input.displayOrder,
          notes: input.notes,
        })
        .select()
        .single<CommercialTermDefaultRow>();
      if (error) throw error;
      return defaultFromRow(data);
    },
    update: async (id, input) => {
      const { data, error } = await client()
        .from("commercial_term_defaults")
        .update({
          label: input.label,
          charge_type: input.chargeType,
          value: input.value,
          optional: input.optional,
          display_order: input.displayOrder,
          notes: input.notes,
        })
        .eq("id", id)
        .select()
        .single<CommercialTermDefaultRow>();
      if (error) throw error;
      return defaultFromRow(data);
    },
    remove: async (id) => {
      const { error } = await client().from("commercial_term_defaults").delete().eq("id", id);
      if (error) throw error;
    },
  };

  const commercialTerms: AdminApiClient["commercialTerms"] = {
    listByImplementation: async (implementationId) => {
      const { data, error } = await client()
        .from("commercial_terms")
        .select()
        .eq("implementation_id", implementationId)
        .order("display_order")
        .returns<CommercialTermRow[]>();
      if (error) throw error;
      return data.map(termFromRow);
    },
    cloneDefaults: async (implementationId) => {
      const existing = await commercialTerms.listByImplementation(implementationId);
      if (existing.length > 0) return existing;
      const defaults = await commercialTermDefaults.list();
      if (defaults.length === 0) return [];
      const { data, error } = await client()
        .from("commercial_terms")
        .insert(
          defaults.map((d) => ({
            implementation_id: implementationId,
            label: d.label,
            charge_type: d.chargeType,
            value: d.value,
            optional: d.optional,
            display_order: d.displayOrder,
            notes: d.notes,
          })),
        )
        .select()
        .returns<CommercialTermRow[]>();
      if (error) throw error;
      return data.map(termFromRow);
    },
    update: async (id, patch) => {
      const { data, error } = await client()
        .from("commercial_terms")
        .update({
          label: patch.label,
          charge_type: patch.chargeType,
          value: patch.value,
          optional: patch.optional,
          display_order: patch.displayOrder,
          notes: patch.notes,
        })
        .eq("id", id)
        .select()
        .single<CommercialTermRow>();
      if (error) throw error;
      return termFromRow(data);
    },
  };

  const outbox: AdminApiClient["outbox"] = {
    listByImplementation: async (implementationId) => {
      const { data, error } = await client()
        .from("outbound_messages")
        .select()
        .eq("implementation_id", implementationId)
        .order("created_at", { ascending: false })
        .returns<OutboundMessageRow[]>();
      if (error) throw error;
      return data.map(outboundMessageFromRow);
    },
    enqueue: async (input) => {
      const { data, error } = await client()
        .from("outbound_messages")
        .insert({
          implementation_id: input.implementationId,
          owner_id: input.ownerId,
          destination: input.destination,
          template: input.template,
          body: input.body,
          status: "queued",
        })
        .select()
        .single<OutboundMessageRow>();
      if (error) throw error;
      return outboundMessageFromRow(data);
    },
    markSent: async (id, providerMessageId) => {
      const { data, error } = await client()
        .from("outbound_messages")
        .update({
          status: "sent",
          provider_message_id: providerMessageId,
          sent_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single<OutboundMessageRow>();
      if (error) throw error;
      return outboundMessageFromRow(data);
    },
    markFailed: async (id, errorMessage) => {
      const { data, error } = await client()
        .from("outbound_messages")
        .update({ status: "failed", error: errorMessage, failed_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single<OutboundMessageRow>();
      if (error) throw error;
      return outboundMessageFromRow(data);
    },
  };

  const initialCharges: AdminApiClient["initialCharges"] = {
    listByImplementation: async (implementationId) => {
      const { data, error } = await client()
        .from("initial_charges")
        .select()
        .eq("implementation_id", implementationId)
        .order("created_at", { ascending: false })
        .returns<InitialChargeRow[]>();
      if (error) throw error;
      return data.map(initialChargeFromRow);
    },
    createFromProposal: async (input) => {
      const supabase = client();
      const { data: existing, error: existingError } = await supabase
        .from("initial_charges")
        .select()
        .eq("proposal_id", input.proposalId)
        .maybeSingle<InitialChargeRow>();
      if (existingError) throw existingError;
      if (existing) return initialChargeFromRow(existing);

      const amount = input.items.reduce((sum, i) => sum + i.amount, 0);

      // Duas tentativas concorrentes de aceitar a MESMA proposta (duplo
      // clique, duas abas) passam pelo `existing` acima antes de qualquer
      // uma inserir — a corrida real só é decidida pelas constraints
      // `unique` do banco (`proposal_id`, `code`), nunca pela checagem em
      // memória. Isso torna a operação idempotente de verdade: quem perde
      // a corrida do `insert` nunca vê um erro cru, só o registro que a
      // outra chamada já criou.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data: currentRows, error: listError } = await supabase
          .from("initial_charges")
          .select("code")
          .returns<{ code: string }[]>();
        if (listError) throw listError;
        const code = nextSequentialCode(
          "COB",
          currentRows.map((r) => r.code),
        );

        const { data, error } = await supabase
          .from("initial_charges")
          .insert({
            code,
            implementation_id: input.implementationId,
            owner_id: input.ownerId,
            proposal_id: input.proposalId,
            items: input.items,
            amount,
            status: "pending",
          })
          .select()
          .single<InitialChargeRow>();

        if (!error) return initialChargeFromRow(data);
        if (!isUniqueViolation(error)) throw error;

        if (constraintTargetsColumn(error, "proposal_id")) {
          const { data: winner, error: refetchError } = await supabase
            .from("initial_charges")
            .select()
            .eq("proposal_id", input.proposalId)
            .single<InitialChargeRow>();
          if (refetchError) throw refetchError;
          return initialChargeFromRow(winner);
        }
        // Colisão só no `code` (duas gerações concorrentes calcularam o
        // mesmo próximo número) — tenta de novo com a lista atualizada.
      }
      throw new Error("Não foi possível gerar um código de cobrança único após várias tentativas");
    },
    updateStatus: async (id, status, patch) => {
      const { data, error } = await client()
        .from("initial_charges")
        .update({
          status,
          payment_reference: patch?.paymentReference,
          paid_at: status === "paid" ? (patch?.paidAt ?? new Date().toISOString()) : undefined,
        })
        .eq("id", id)
        .select()
        .single<InitialChargeRow>();
      if (error) throw error;
      return initialChargeFromRow(data);
    },
  };

  const ownerOnboarding: AdminApiClient["ownerOnboarding"] = {
    // getLink/createLink/revoke/getSubmission são chamados só pela tela
    // autenticada do time interno — leitura/escrita direta sob RLS, mesmo
    // padrão do resto deste adapter.
    getLink: async (implementationId) => {
      const { data, error } = await client()
        .from("owner_portal_invitations")
        .select()
        .eq("implementation_id", implementationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<OwnerOnboardingLinkRow>();
      if (error) throw error;
      return data ? ownerOnboardingLinkFromRow(data) : null;
    },
    createLink: async (
      implementationId,
      ownerId,
      validityDays = DEFAULT_INVITATION_VALIDITY_DAYS,
    ) => {
      const supabase = client();
      const now = new Date();
      const token = newId();
      const tokenHash = await hashToken(token);

      const { error: revokeError } = await supabase
        .from("owner_portal_invitations")
        .update({ revoked_at: now.toISOString() })
        .eq("implementation_id", implementationId)
        .is("revoked_at", null)
        .is("used_at", null);
      if (revokeError) throw revokeError;

      const { data, error } = await supabase
        .from("owner_portal_invitations")
        .insert({
          implementation_id: implementationId,
          owner_id: ownerId,
          token_hash: tokenHash,
          expires_at: new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single<OwnerOnboardingLinkRow>();
      if (error) throw error;
      await audit.log({
        actorId: null,
        event: "portal.invitation_created",
        entityType: "implementation",
        entityId: implementationId,
        metadata: {},
      });
      return { link: ownerOnboardingLinkFromRow(data), token };
    },
    revoke: async (id) => {
      const { data, error } = await client()
        .from("owner_portal_invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single<OwnerOnboardingLinkRow>();
      if (error) throw error;
      const link = ownerOnboardingLinkFromRow(data);
      await audit.log({
        actorId: null,
        event: "portal.invitation_revoked",
        entityType: "implementation",
        entityId: link.implementationId,
        metadata: {},
      });
      return link;
    },
    getSubmission: async (implementationId) => {
      const { data: profile, error: profileError } = await client().from("owner_onboarding_profiles").select().eq("implementation_id", implementationId).maybeSingle();
      if (profileError) throw profileError;
      if (profile) {
        const { data: payout, error: payoutError } = await client().from("owner_payout_accounts").select().eq("implementation_id", implementationId).maybeSingle();
        if (payoutError) throw payoutError;
        return ownerOnboardingFromDraft({ ...profile, ...(payout ?? {}) }, implementationId);
      }
      const { data, error } = await client().from("owner_onboarding_submissions").select().eq("implementation_id", implementationId).maybeSingle<OwnerOnboardingSubmissionRow>();
      if (error) throw error;
      return data ? ownerOnboardingSubmissionFromRow(data) : null;
    },
    getDraft: async (token) => {
      const { data, error } = await client().rpc("owner_onboarding_draft_resolve", { p_token: token });
      if (error) throw error;
      return data ? ownerOnboardingFromDraft(data as Record<string, unknown>) : null;
    },
    saveDraft: async (token, input, currentStep, submit = false) => {
      const { data, error } = await client().rpc("owner_onboarding_draft_save", {
        p_token: token,
        p_submit: submit,
        p_data: { ...input, legalName: input.fullName, taxId: input.document, currentStep, confirmed: submit },
      });
      if (error) throw error;
      return ownerOnboardingFromDraft(data as Record<string, unknown>);
    },
    // findByToken/submit são chamados pelo portal público, sem sessão
    // autenticada — nunca tocam a tabela direto sob RLS (que exige papel
    // do time interno). Passam pelas funções security-definer da migration
    // 0007, que revalidam tudo (hash do token, expiração/revogação/uso)
    // dentro do próprio banco antes de gravar. Sem sessão autenticada,
    // `audit.log()` seria rejeitado pela RLS de audit_logs (exige
    // actor_id = auth.uid()) — o registro do envio em si já é o rastro
    // desse evento.
    findByToken: async (token) => {
      const { data, error } = await client()
        .rpc("owner_onboarding_resolve_token", { p_token: token })
        .maybeSingle<{
          implementation_id: string;
          expires_at: string;
          used_at: string | null;
          revoked_at: string | null;
        }>();
      if (error) throw error;
      if (!data) return null;
      return {
        id: "",
        implementationId: data.implementation_id,
        ownerId: null,
        tokenHash: "",
        createdAt: "",
        createdBy: null,
        expiresAt: data.expires_at,
        usedAt: data.used_at,
        revokedAt: data.revoked_at,
        lastAccessAt: null,
      };
    },
    submit: async (_implementationId, token, input) => {
      return ownerOnboarding.saveDraft(token, input, 5, true);
    },
  };

  const ownerTasks: AdminApiClient["ownerTasks"] = {
    listByOwner: async (ownerId) => {
      const { data, error } = await client()
        .from("owner_tasks")
        .select()
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .returns<OwnerTaskRow[]>();
      if (error) throw error;
      return data.map(ownerTaskFromRow);
    },
    create: async (input) => {
      const { data, error } = await client()
        .from("owner_tasks")
        .insert({
          owner_id: input.ownerId,
          implementation_id: input.implementationId,
          kind: input.kind,
          title: input.title,
          description: input.description,
        })
        .select()
        .single<OwnerTaskRow>();
      if (error) throw error;
      return ownerTaskFromRow(data);
    },
    updateStatus: async (id, status) => {
      const { data, error } = await client()
        .from("owner_tasks")
        .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
        .eq("id", id)
        .select()
        .single<OwnerTaskRow>();
      if (error) throw error;
      return ownerTaskFromRow(data);
    },
  };

  return {
    audit,
    owners,
    commercialTermDefaults,
    commercialTerms,
    outbox,
    initialCharges,
    ownerOnboarding,
    ownerTasks,
  };
}

/** Ponto único de decisão mock vs real — nenhuma tela deve checar env var. */
export function createDefaultAdminApiClient(): AdminApiClient {
  return isSupabaseConfigured() ? createSupabaseAdminApiClient() : createLocalAdminApiClient();
}
