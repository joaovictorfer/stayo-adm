/**
 * Cadastro comercial do proprietário (etapa inicial, antes do cadastro completo).
 *
 * - Link próprio (`owner_intake_links`), separado por trigger dos links de
 *   proposta e de onboarding completo: o token de apresentação não grava nada
 *   e o onboarding completo nunca aceita este token.
 * - O proprietário só escreve em `owner_intake_submissions` (whitelist no
 *   banco). Nada chega à ficha oficial sem a aprovação da equipe.
 */
import { getSupabaseBrowserClient, getSupabasePublicBrowserClient } from "./supabase-client";
import { hashToken } from "./token-hash";

export interface OwnerIntakeData {
  fullName?: string;
  phone?: string;
  email?: string;
  city?: string;
  district?: string;
  postalCode?: string;
  locationName?: string;
  unitLabel?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  capacity?: number;
  notes?: string;
}

export type OwnerIntakeStatus =
  "draft" | "submitted" | "approved" | "correction_requested" | "discarded";

export const intakeStatusLabel: Record<OwnerIntakeStatus, string> = {
  draft: "Em preenchimento",
  submitted: "Pendente de revisão",
  approved: "Aprovado",
  correction_requested: "Correção solicitada",
  discarded: "Descartado",
};

export interface OwnerIntakeLink {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastAccessAt: string | null;
}

export interface OwnerIntakeSubmission {
  status: OwnerIntakeStatus;
  currentStep: number;
  data: OwnerIntakeData;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  updatedAt: string;
}

export interface OfficialSnapshot {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  district: string | null;
  postalCode: string | null;
  locationName: string | null;
  unitLabel: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  capacity: number | null;
}

export const propertyTypeOptions = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "studio", label: "Studio" },
  { value: "cobertura", label: "Cobertura" },
  { value: "chale", label: "Chalé" },
  { value: "outro", label: "Outro" },
];

export const propertyTypeLabel = (v?: string | null) =>
  propertyTypeOptions.find((o) => o.value === v)?.label ?? v ?? "";

function client() {
  const c = getSupabaseBrowserClient();
  if (!c) throw new Error("Banco indisponível.");
  return c;
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function intakeUrl(token: string) {
  return `${window.location.origin}/portal/cadastro/${token}`;
}

export function intakeWhatsappMessage(name: string | null | undefined, link: string) {
  const first = name?.trim().split(/\s+/)[0];
  return `${first ? `Oi, ${first}!` : "Oi!"} Para seguirmos, me conte um pouco sobre você e o seu imóvel neste link. Leva uns 3 minutos e dá para fazer pelo celular: ${link}`;
}

export const ownerIntakeAdminApi = {
  async currentLink(implementationId: string): Promise<OwnerIntakeLink | null> {
    const { data, error } = await client()
      .from("owner_intake_links")
      .select("id, created_at, expires_at, revoked_at, last_access_at")
      .eq("implementation_id", implementationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      revokedAt: data.revoked_at,
      lastAccessAt: data.last_access_at,
    };
  },

  async issue(implementationId: string, validDays: number) {
    const db = client();
    const now = new Date();
    const { error: revokeError } = await db
      .from("owner_intake_links")
      .update({ revoked_at: now.toISOString() })
      .eq("implementation_id", implementationId)
      .is("revoked_at", null);
    if (revokeError) throw revokeError;
    const token = newToken();
    const { error } = await db.from("owner_intake_links").insert({
      implementation_id: implementationId,
      token_hash: await hashToken(token),
      expires_at: new Date(now.getTime() + validDays * 86_400_000).toISOString(),
    });
    if (error) throw error;
    return token;
  },

  async revoke(linkId: string) {
    const { error } = await client()
      .from("owner_intake_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", linkId);
    if (error) throw error;
  },

  async submission(implementationId: string): Promise<OwnerIntakeSubmission | null> {
    const { data, error } = await client()
      .from("owner_intake_submissions")
      .select("*")
      .eq("implementation_id", implementationId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      status: data.status as OwnerIntakeStatus,
      currentStep: data.current_step,
      data: (data.data ?? {}) as OwnerIntakeData,
      submittedAt: data.submitted_at,
      reviewedAt: data.reviewed_at,
      reviewedByName: data.reviewed_by_name,
      reviewNote: data.review_note,
      updatedAt: data.updated_at,
    };
  },

  async official(implementationId: string): Promise<OfficialSnapshot> {
    const db = client();
    const { data: p, error } = await db
      .from("implementation_projects")
      .select(
        "owner_id, city, postal_code, condominium_name, unit, property_type, bedrooms, capacity",
      )
      .eq("id", implementationId)
      .single();
    if (error) throw error;
    const [{ data: d }, owner] = await Promise.all([
      db
        .from("implementation_property_details")
        .select("bathrooms, district")
        .eq("implementation_id", implementationId)
        .maybeSingle(),
      p.owner_id
        ? db.from("owner_records").select("name, phone, email").eq("id", p.owner_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return {
      fullName: owner.data?.name ?? null,
      phone: owner.data?.phone ?? null,
      email: owner.data?.email ?? null,
      city: p.city,
      district: d?.district ?? null,
      postalCode: p.postal_code,
      locationName: p.condominium_name,
      unitLabel: p.unit,
      propertyType: p.property_type,
      bedrooms: p.bedrooms,
      bathrooms: d?.bathrooms ?? null,
      capacity: p.capacity,
    };
  },

  async review(input: {
    implementationId: string;
    decision: "approve" | "request_correction" | "keep_pending";
    note?: string;
  }) {
    const { error } = await client().rpc("admin_review_owner_intake", { p_data: input });
    if (error) throw error;
  },
};

// ---------- Público (token) ----------

export type IntakeResolve =
  | {
      state: "active";
      status: OwnerIntakeStatus;
      currentStep: number;
      data: OwnerIntakeData;
      submittedAt: string | null;
      correctionNote: string | null;
    }
  | { state: "invalid" | "expired" | "revoked" | "network" };

export async function resolveIntake(token: string): Promise<IntakeResolve> {
  const db = getSupabasePublicBrowserClient();
  if (!db) return { state: "network" };
  try {
    const { data, error } = await db.rpc("owner_intake_resolve", { p_token: token });
    if (error || !data) return { state: "network" };
    return data as IntakeResolve;
  } catch {
    return { state: "network" };
  }
}

export async function saveIntake(
  token: string,
  data: OwnerIntakeData,
  step: number,
  submit: boolean,
): Promise<{ status: OwnerIntakeStatus }> {
  const db = getSupabasePublicBrowserClient();
  if (!db) throw new Error("Sem conexão.");
  const { data: r, error } = await db.rpc("owner_intake_save", {
    p_token: token,
    p_data: data as never,
    p_step: step,
    p_submit: submit,
  });
  if (error) throw new Error(error.message || "Não foi possível salvar.");
  return r as { status: OwnerIntakeStatus };
}
