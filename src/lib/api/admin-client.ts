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
 * §6 e as Fases 2–10 do plano): hoje só tem o vertical de auditoria, que é
 * a base sobre a qual toda ação sensível das fases seguintes vai logar.
 */

import type { AuditEvent, AuditLogEntry, AuditLogInput } from "../../types/audit";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "./supabase-client";
import { newId, read, write } from "./local-store";

export interface AdminApiClient {
  audit: {
    log(input: AuditLogInput): Promise<AuditLogEntry>;
    list(params?: { entityType?: string; entityId?: string }): Promise<AuditLogEntry[]>;
  };
}

const AUDIT_LOGS_KEY = "stayo-admin:audit-logs";

/** Adapter local — usado enquanto não há credencial Supabase configurada. */
export function createLocalAdminApiClient(): AdminApiClient {
  return {
    audit: {
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
    },
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

function fromRow(row: AuditLogRow): AuditLogEntry {
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

/** Adapter real — requer projeto Supabase com a migration 0001 aplicada. */
export function createSupabaseAdminApiClient(): AdminApiClient {
  return {
    audit: {
      log: async (input) => {
        const client = getSupabaseBrowserClient();
        if (!client) throw new Error("Supabase não configurado");
        const { data: session } = await client.auth.getUser();
        const { data, error } = await client
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
        return fromRow(data);
      },
      list: async (params) => {
        const client = getSupabaseBrowserClient();
        if (!client) throw new Error("Supabase não configurado");
        let query = client.from("audit_logs").select().order("created_at", { ascending: false });
        if (params?.entityType) query = query.eq("entity_type", params.entityType);
        if (params?.entityId) query = query.eq("entity_id", params.entityId);
        const { data, error } = await query.returns<AuditLogRow[]>();
        if (error) throw error;
        return data.map(fromRow);
      },
    },
  };
}

/** Ponto único de decisão mock vs real — nenhuma tela deve checar env var. */
export function createDefaultAdminApiClient(): AdminApiClient {
  return isSupabaseConfigured() ? createSupabaseAdminApiClient() : createLocalAdminApiClient();
}
