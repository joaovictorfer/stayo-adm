import { normalizePhone } from "../owner-form-validation";
import { getSupabaseBrowserClient } from "./supabase-client";

export interface OpportunityContactCandidate {
  id: string;
  name: string;
  phone: string | null;
  lifecycleStatus: string;
}

export interface CreateOpportunityInput {
  contactName: string;
  phone: string;
  title: string;
  responsibleUserId: string | null;
  existingOwnerId: string | null;
  requestId: string;
}

export interface CreateOpportunityResult {
  implementationId: string;
}

type RpcError = { message?: string; code?: string };
type UntypedRpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: RpcError | null }>;
};

type OpportunityRow = { id?: string } | Array<{ id?: string }> | null;
type DuplicateRow = {
  id: string;
  name: string;
  phone: string | null;
  lifecycle_status: string;
};

function client(): UntypedRpcClient {
  const value = getSupabaseBrowserClient();
  if (!value) throw new Error("O banco do Admin não está disponível.");
  return value as unknown as UntypedRpcClient;
}

function migrationPending(error: RpcError): boolean {
  return (
    error.code === "PGRST202" ||
    Boolean(error.message?.includes("admin_create_opportunity")) ||
    Boolean(error.message?.includes("admin_find_owner_phone_duplicates"))
  );
}

function firstOpportunityId(value: OpportunityRow): string | null {
  if (Array.isArray(value)) return value[0]?.id ?? null;
  return value?.id ?? null;
}

export async function findOpportunityContactDuplicates(
  phone: string,
): Promise<OpportunityContactCandidate[]> {
  const normalized = normalizePhone(phone);
  if (!/^55\d{10,11}$/.test(normalized)) return [];

  const { data, error } = await client().rpc("admin_find_owner_phone_duplicates", {
    p_phone: normalized,
  });
  if (error) {
    if (migrationPending(error)) return [];
    throw new Error(error.message || "Não foi possível verificar contatos existentes.");
  }

  return ((data ?? []) as DuplicateRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    lifecycleStatus: row.lifecycle_status,
  }));
}

export async function createOpportunity(
  input: CreateOpportunityInput,
): Promise<CreateOpportunityResult> {
  const { data, error } = await client().rpc("admin_create_opportunity", {
    p_data: {
      contactName: input.contactName.trim(),
      phone: normalizePhone(input.phone),
      title: input.title.trim(),
      responsibleUserId: input.responsibleUserId,
      existingOwnerId: input.existingOwnerId,
      requestId: input.requestId,
    },
  });

  if (error) {
    if (migrationPending(error)) {
      throw new Error(
        "A criação leve ainda não está habilitada no banco deste ambiente. A migration da Fase 1 precisa ser aplicada antes de usar este fluxo.",
      );
    }
    throw new Error(error.message || "Não foi possível criar a oportunidade.");
  }

  const implementationId = firstOpportunityId(data as OpportunityRow);
  if (!implementationId) throw new Error("O banco não devolveu a oportunidade criada.");
  return { implementationId };
}

export interface CreateInviteOpportunityInput {
  title: string;
  responsibleUserId: string | null;
  requestId: string;
}

/**
 * Caminho "Convidar proprietário": oportunidade sem proprietário, telefone,
 * condomínio ou imóvel. Depende da migration 0024 (admin_create_invite_opportunity).
 */
export async function createInviteOpportunity(
  input: CreateInviteOpportunityInput,
): Promise<CreateOpportunityResult> {
  const { data, error } = await client().rpc("admin_create_invite_opportunity", {
    p_data: {
      title: input.title.trim(),
      responsibleUserId: input.responsibleUserId,
      requestId: input.requestId,
    },
  });
  if (error) {
    if (error.code === "PGRST202" || error.message?.includes("admin_create_invite_opportunity")) {
      throw new Error(
        "O convite sem proprietário ainda não está habilitado no banco. A migration 0024 precisa ser aplicada.",
      );
    }
    throw new Error(error.message || "Não foi possível preparar o convite.");
  }
  const implementationId = firstOpportunityId(data as OpportunityRow);
  if (!implementationId) throw new Error("O banco não devolveu a oportunidade criada.");
  return { implementationId };
}

/* ---------- Formulário progressivo único (rascunho) ---------- */

export async function createDraftOpportunity(input: {
  title?: string;
  responsibleUserId: string | null;
  requestId: string;
}): Promise<CreateOpportunityResult> {
  const { data, error } = await client().rpc("admin_create_draft_opportunity", {
    p_data: {
      title: (input.title ?? "").trim(),
      responsibleUserId: input.responsibleUserId,
      requestId: input.requestId,
    },
  });
  if (error) throw new Error(error.message || "Não foi possível abrir a oportunidade.");
  const implementationId = firstOpportunityId(data as OpportunityRow);
  if (!implementationId) throw new Error("O banco não devolveu a oportunidade criada.");
  return { implementationId };
}

export async function saveOpportunityContact(
  implementationId: string,
  input: { contactName: string; phone: string; title: string; existingOwnerId: string | null },
): Promise<void> {
  const { error } = await client().rpc("admin_save_opportunity_contact", {
    p_implementation_id: implementationId,
    p_data: {
      contactName: input.contactName.trim(),
      phone: input.phone.trim() ? normalizePhone(input.phone) : "",
      title: input.title.trim(),
      existingOwnerId: input.existingOwnerId,
    },
  });
  if (error) throw new Error(error.message || "Não foi possível salvar os dados.");
}

export async function completeOpportunityDraft(implementationId: string): Promise<void> {
  const { error } = await client().rpc("admin_complete_opportunity_draft", {
    p_implementation_id: implementationId,
  });
  if (error) throw new Error(error.message || "Não foi possível concluir.");
}

export async function getOpportunityDraftState(
  implementationId: string,
): Promise<{ isDraft: boolean; completedAt: string | null }> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { isDraft: false, completedAt: null };
  const { data, error } = await sb
    .from("implementation_projects")
    .select("origin, draft_completed_at")
    .eq("id", implementationId)
    .maybeSingle();
  if (error || !data) return { isDraft: false, completedAt: null };
  const row = data as { origin: string | null; draft_completed_at: string | null };
  return {
    isDraft: /^admin_(draft|opportunity):/.test(row.origin ?? "") && !row.draft_completed_at,
    completedAt: row.draft_completed_at,
  };
}
