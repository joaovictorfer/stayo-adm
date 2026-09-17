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
import type { OwnerRecord, OwnerRecordInput } from "../../types/admin";
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
}

const AUDIT_LOGS_KEY = "stayo-admin:audit-logs";
const OWNER_RECORDS_KEY = "stayo-admin:owner-records";

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

  return { audit, owners };
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

  return { audit, owners };
}

/** Ponto único de decisão mock vs real — nenhuma tela deve checar env var. */
export function createDefaultAdminApiClient(): AdminApiClient {
  return isSupabaseConfigured() ? createSupabaseAdminApiClient() : createLocalAdminApiClient();
}
