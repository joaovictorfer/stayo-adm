/**
 * Migração do localStorage → Supabase (Fase 13 — ver
 * docs/LOCALSTORAGE_MIGRATION.md para o mapa completo de toda chave
 * `stayo-admin:*` e por que só estas cinco entram aqui).
 *
 * `collectLocalAdminSnapshot()` é pura e roda em qualquer ambiente —
 * usada tanto pelo importador quanto por testes. `importLocalAdminDataToSupabase()`
 * só faz algo quando o Supabase está configurado; nunca inventa uma
 * conexão. Usa `upsert` (nunca `insert`) com o UUID já existente no
 * protótipo, então rodar mais de uma vez nunca duplica linha.
 *
 * `audit-logs` fica de fora de propósito: a RLS de `audit_logs` exige
 * `actor_id = auth.uid()`, e todo evento local tem `actorId: null` — migrar
 * esse histórico precisa de um script service_role fora do browser, nunca
 * da chave anon usada aqui (ver docs/LOCALSTORAGE_MIGRATION.md).
 */

import {
  COMMERCIAL_TERMS_KEY,
  COMMERCIAL_TERM_DEFAULTS_KEY,
  INITIAL_CHARGES_KEY,
  OUTBOUND_MESSAGES_KEY,
  OWNER_RECORDS_KEY,
} from "../api/admin-client";
import { read } from "../api/local-store";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../api/supabase-client";
import type {
  CommercialTerm,
  CommercialTermDefault,
  InitialCharge,
  OutboundMessage,
  OwnerRecord,
} from "../../types/admin";

export interface LocalAdminSnapshot {
  ownerRecords: OwnerRecord[];
  commercialTermDefaults: CommercialTermDefault[];
  commercialTerms: CommercialTerm[];
  outboundMessages: OutboundMessage[];
  initialCharges: InitialCharge[];
}

/** Lê as cinco chaves já migráveis do localStorage — nunca toca o Supabase. */
export function collectLocalAdminSnapshot(): LocalAdminSnapshot {
  return {
    ownerRecords: read<OwnerRecord>(OWNER_RECORDS_KEY),
    commercialTermDefaults: read<CommercialTermDefault>(COMMERCIAL_TERM_DEFAULTS_KEY),
    commercialTerms: read<CommercialTerm>(COMMERCIAL_TERMS_KEY),
    outboundMessages: read<OutboundMessage>(OUTBOUND_MESSAGES_KEY),
    initialCharges: read<InitialCharge>(INITIAL_CHARGES_KEY),
  };
}

export interface ImportResult {
  table: string;
  imported: number;
}

export class SupabaseNotConfiguredError extends Error {}

/**
 * Envia o snapshot local para o Supabase, em ordem de dependência lógica
 * (nenhuma tem FK de banco entre si hoje — ver
 * docs/LOCALSTORAGE_MIGRATION.md). Idempotente: `upsert` por `id`.
 */
export async function importLocalAdminDataToSupabase(
  snapshot: LocalAdminSnapshot = collectLocalAdminSnapshot(),
): Promise<ImportResult[]> {
  if (!isSupabaseConfigured()) {
    throw new SupabaseNotConfiguredError(
      "Supabase não está configurado (VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes) — nada foi importado.",
    );
  }
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new SupabaseNotConfiguredError("Cliente Supabase indisponível.");
  }

  const results: ImportResult[] = [];

  const upsertAll = async (table: string, rows: Record<string, unknown>[]): Promise<void> => {
    if (rows.length === 0) {
      results.push({ table, imported: 0 });
      return;
    }
    const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
    if (error) throw error;
    results.push({ table, imported: rows.length });
  };

  await upsertAll(
    "owner_records",
    snapshot.ownerRecords.map((o) => ({
      id: o.id,
      name: o.name,
      phone: o.phone,
      email: o.email,
      document: o.document,
      lifecycle_status: o.lifecycleStatus,
      core_owner_id: o.coreOwnerId,
      created_at: o.createdAt,
      updated_at: o.updatedAt,
    })),
  );

  await upsertAll(
    "commercial_term_defaults",
    snapshot.commercialTermDefaults.map((d) => ({
      id: d.id,
      label: d.label,
      charge_type: d.chargeType,
      value: d.value,
      optional: d.optional,
      display_order: d.displayOrder,
      notes: d.notes,
    })),
  );

  await upsertAll(
    "commercial_terms",
    snapshot.commercialTerms.map((t) => ({
      id: t.id,
      implementation_id: t.implementationId,
      label: t.label,
      charge_type: t.chargeType,
      value: t.value,
      optional: t.optional,
      display_order: t.displayOrder,
      notes: t.notes,
    })),
  );

  await upsertAll(
    "outbound_messages",
    snapshot.outboundMessages.map((m) => ({
      id: m.id,
      implementation_id: m.implementationId,
      owner_id: m.ownerId,
      destination: m.destination,
      template: m.template,
      body: m.body,
      status: m.status,
      provider_message_id: m.providerMessageId,
      error: m.error,
      created_at: m.createdAt,
      sent_at: m.sentAt,
      failed_at: m.failedAt,
    })),
  );

  await upsertAll(
    "initial_charges",
    snapshot.initialCharges.map((c) => ({
      id: c.id,
      code: c.code,
      implementation_id: c.implementationId,
      owner_id: c.ownerId,
      proposal_id: c.proposalId,
      items: c.items,
      amount: c.amount,
      status: c.status,
      due_at: c.dueAt,
      payment_reference: c.paymentReference,
      paid_at: c.paidAt,
      notes: c.notes,
      created_at: c.createdAt,
    })),
  );

  return results;
}
