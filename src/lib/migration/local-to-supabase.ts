/**
 * Migração do localStorage → Supabase (Fase 13, estendida na Fase 16 — ver
 * docs/LOCALSTORAGE_MIGRATION.md para o mapa completo de toda chave
 * `stayo-admin:*` e por que só estas sete entram aqui).
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
  OWNER_ONBOARDING_LINKS_KEY,
  OWNER_ONBOARDING_SUBMISSIONS_KEY,
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
import type { OwnerOnboardingLink, OwnerOnboardingSubmission } from "../../types/owner-onboarding";

export interface LocalAdminSnapshot {
  ownerRecords: OwnerRecord[];
  commercialTermDefaults: CommercialTermDefault[];
  commercialTerms: CommercialTerm[];
  outboundMessages: OutboundMessage[];
  initialCharges: InitialCharge[];
  ownerOnboardingLinks: OwnerOnboardingLink[];
  ownerOnboardingSubmissions: OwnerOnboardingSubmission[];
}

/** Lê as sete chaves já migráveis do localStorage — nunca toca o Supabase. */
export function collectLocalAdminSnapshot(): LocalAdminSnapshot {
  return {
    ownerRecords: read<OwnerRecord>(OWNER_RECORDS_KEY),
    commercialTermDefaults: read<CommercialTermDefault>(COMMERCIAL_TERM_DEFAULTS_KEY),
    commercialTerms: read<CommercialTerm>(COMMERCIAL_TERMS_KEY),
    outboundMessages: read<OutboundMessage>(OUTBOUND_MESSAGES_KEY),
    initialCharges: read<InitialCharge>(INITIAL_CHARGES_KEY),
    ownerOnboardingLinks: read<OwnerOnboardingLink>(OWNER_ONBOARDING_LINKS_KEY),
    ownerOnboardingSubmissions: read<OwnerOnboardingSubmission>(OWNER_ONBOARDING_SUBMISSIONS_KEY),
  };
}

export interface ImportResult {
  table: string;
  imported: number;
}

export interface ValidationResult {
  table: string;
  expected: number;
  foundInSupabase: number;
  ok: boolean;
}

export class SupabaseNotConfiguredError extends Error {}

/**
 * Passo "validate" do fluxo detect→preview→import→validate→mark-migrated
 * (seção 32 do plano): depois do `upsert`, confere de verdade que cada
 * tabela tem pelo menos as linhas que o snapshot local mandou — nunca
 * confia só no fato de `upsert` não ter lançado erro. Não compara linha a
 * linha (o objetivo aqui é pego auditável, não um diff completo); um
 * `foundInSupabase < expected` é sinal de que algo não persistiu.
 */
export async function validateSupabaseImport(
  snapshot: LocalAdminSnapshot = collectLocalAdminSnapshot(),
): Promise<ValidationResult[]> {
  if (!isSupabaseConfigured()) {
    throw new SupabaseNotConfiguredError(
      "Supabase não está configurado (VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes) — nada para validar.",
    );
  }
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new SupabaseNotConfiguredError("Cliente Supabase indisponível.");
  }

  const countTable = async (table: string, expected: number): Promise<ValidationResult> => {
    if (expected === 0) return { table, expected: 0, foundInSupabase: 0, ok: true };
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
    if (error) throw error;
    const foundInSupabase = count ?? 0;
    return { table, expected, foundInSupabase, ok: foundInSupabase >= expected };
  };

  return Promise.all([
    countTable("owner_records", snapshot.ownerRecords.length),
    countTable("commercial_term_defaults", snapshot.commercialTermDefaults.length),
    countTable("commercial_terms", snapshot.commercialTerms.length),
    countTable("outbound_messages", snapshot.outboundMessages.length),
    countTable("initial_charges", snapshot.initialCharges.length),
    countTable("owner_portal_invitations", snapshot.ownerOnboardingLinks.length),
    countTable("owner_onboarding_submissions", snapshot.ownerOnboardingSubmissions.length),
  ]);
}

export interface MigrationStatus {
  lastImportedAt: string;
  lastValidatedAt: string | null;
  allValid: boolean;
}

const MIGRATION_STATUS_KEY = "stayo-admin:migration-status";

/**
 * Marca a migração como concluída neste navegador — não impede um novo
 * import (o `upsert` já torna isso seguro por natureza), só dá à tela um
 * jeito de dizer "isto aqui já rodou" em vez de tratar todo carregamento
 * de página como a primeira vez. Nunca apaga o localStorage de origem —
 * isso é uma decisão deliberada do plano (seção 32): a marca é só um sinal
 * de que já foi enviado, o dado local original continua intacto até uma
 * limpeza manual e consciente, fora do escopo deste importador.
 */
export function readMigrationStatus(): MigrationStatus | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(MIGRATION_STATUS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MigrationStatus;
  } catch {
    return null;
  }
}

export function writeMigrationStatus(status: MigrationStatus): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify(status));
}

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

  const upsertAll = async (
    table: string,
    rows: Record<string, unknown>[],
    onConflict: string = "id",
  ): Promise<void> => {
    if (rows.length === 0) {
      results.push({ table, imported: 0 });
      return;
    }
    const { error } = await client.from(table).upsert(rows, { onConflict });
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

  await upsertAll(
    "owner_portal_invitations",
    snapshot.ownerOnboardingLinks.map((l) => ({
      id: l.id,
      implementation_id: l.implementationId,
      token_hash: l.tokenHash,
      created_at: l.createdAt,
      created_by: l.createdBy,
      expires_at: l.expiresAt,
      used_at: l.usedAt,
      revoked_at: l.revokedAt,
      last_access_at: l.lastAccessAt,
    })),
  );

  await upsertAll(
    "owner_onboarding_submissions",
    snapshot.ownerOnboardingSubmissions.map((s) => ({
      implementation_id: s.implementationId,
      full_name: s.fullName,
      document: s.document,
      email: s.email,
      phone: s.phone,
      pix_key: s.pixKey,
      submitted_at: s.submittedAt,
    })),
    "implementation_id",
  );

  return results;
}
