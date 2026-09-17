/**
 * Camada de acesso ao domínio PRÓPRIO do Stayo Admin (Grupo A — ver
 * docs/OWNER_IMPLEMENTATION_AUDIT.md §4 e §6).
 *
 * Mesmo princípio do `core-client.ts`: nenhuma tela decide mock-vs-real.
 * `createDefaultAdminApiClient()` escolhe o adapter Supabase quando
 * `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` existem, e cai para o
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
  OutboundMessage,
  OutboundMessageInput,
  OwnerRecord,
  OwnerRecordInput,
} from "../../types/admin";
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
}

const AUDIT_LOGS_KEY = "stayo-admin:audit-logs";
const OWNER_RECORDS_KEY = "stayo-admin:owner-records";
const COMMERCIAL_TERM_DEFAULTS_KEY = "stayo-admin:commercial-term-defaults";
const COMMERCIAL_TERMS_KEY = "stayo-admin:commercial-terms";
const OUTBOUND_MESSAGES_KEY = "stayo-admin:outbound-messages";

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

  return { audit, owners, commercialTermDefaults, commercialTerms, outbox };
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

  return { audit, owners, commercialTermDefaults, commercialTerms, outbox };
}

/** Ponto único de decisão mock vs real — nenhuma tela deve checar env var. */
export function createDefaultAdminApiClient(): AdminApiClient {
  return isSupabaseConfigured() ? createSupabaseAdminApiClient() : createLocalAdminApiClient();
}
