/**
 * Convite de apresentação do proprietário.
 *
 * Reutiliza `proposal_share_links` com `link_type = 'presentation'` (migration 0023):
 * - somente leitura: o aceite legado recusa tokens presentation;
 * - expiração obrigatória e revogação no próprio registro;
 * - separado por trigger dos convites de cadastro (`owner_portal_invitations`);
 * - vínculo com UMA versão publicada de UMA oportunidade (PK = proposal_id).
 *
 * O token nunca é gravado — só o SHA-256. Por isso o link só pode ser copiado
 * logo após ser gerado; depois disso é preciso gerar um novo (o anterior deixa
 * de funcionar).
 */
import { getSupabaseBrowserClient, getSupabasePublicBrowserClient } from "./supabase-client";
import { hashToken } from "./token-hash";
import type { CommercialProposalSnapshot } from "../../types/commercial-proposal";

export interface PresentationInvite {
  proposalId: string;
  implementationId: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export type PresentationInviteStatus = "active" | "expired" | "revoked";

export function inviteStatus(
  invite: PresentationInvite,
  now = new Date(),
): PresentationInviteStatus {
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < now.getTime()) return "expired";
  return "active";
}

function client() {
  const value = getSupabaseBrowserClient();
  if (!value) throw new Error("Banco indisponível. Nenhum convite foi gerado.");
  return value;
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

type Row = {
  proposal_id: string;
  implementation_id: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

const fromRow = (r: Row): PresentationInvite => ({
  proposalId: r.proposal_id,
  implementationId: r.implementation_id,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  revokedAt: r.revoked_at,
});

export const presentationInvitesApi = {
  async list(implementationId: string): Promise<PresentationInvite[]> {
    const { data, error } = await client()
      .from("proposal_share_links")
      .select("proposal_id, implementation_id, created_at, expires_at, revoked_at")
      .eq("implementation_id", implementationId)
      .eq("link_type", "presentation")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as Row[]).map(fromRow);
  },

  /** Gera (ou regenera) o link da versão escolhida e revoga os demais da oportunidade. */
  async issue(input: {
    implementationId: string;
    proposalId: string;
    validDays: number;
  }): Promise<{ token: string; invite: PresentationInvite }> {
    const db = client();
    const token = newToken();
    const tokenHash = await hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.validDays * 86_400_000).toISOString();

    const { error: revokeError } = await db
      .from("proposal_share_links")
      .update({ revoked_at: now.toISOString() })
      .eq("implementation_id", input.implementationId)
      .neq("proposal_id", input.proposalId)
      .is("revoked_at", null);
    if (revokeError) throw revokeError;

    const { data, error } = await db
      .from("proposal_share_links")
      .upsert(
        {
          proposal_id: input.proposalId,
          implementation_id: input.implementationId,
          token_hash: tokenHash,
          link_type: "presentation",
          created_at: now.toISOString(),
          expires_at: expiresAt,
          revoked_at: null,
        },
        { onConflict: "proposal_id" },
      )
      .select("proposal_id, implementation_id, created_at, expires_at, revoked_at")
      .single();
    if (error) throw error;
    return { token, invite: fromRow(data as Row) };
  },

  async revoke(proposalId: string): Promise<void> {
    const { error } = await client()
      .from("proposal_share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("proposal_id", proposalId)
      .eq("link_type", "presentation");
    if (error) throw error;
  },
};

export type PresentationResult =
  | { state: "active"; snapshot: CommercialProposalSnapshot }
  | { state: "invalid" | "expired" | "revoked" | "network" };

/** Leitura pública (anônima) — estado do link + whitelist do snapshot publicado. */
export async function resolvePresentation(token: string): Promise<PresentationResult> {
  const db = getSupabasePublicBrowserClient();
  if (!db) return { state: "network" };
  try {
    const status = await db.rpc("proposal_public_link_status", { p_token: token });
    if (status.error) return { state: "network" };
    const value = status.data as string;
    if (value === "expired" || value === "revoked" || value === "invalid") return { state: value };
    const { data, error } = await db.rpc("proposal_public_resolve_by_token", { p_token: token });
    if (error) return { state: "network" };
    if (!data) return { state: "invalid" };
    return { state: "active", snapshot: data as CommercialProposalSnapshot };
  } catch {
    return { state: "network" };
  }
}

export function presentationUrl(token: string): string {
  return `${window.location.origin}/portal/apresentacao/${token}`;
}

export function whatsappMessage(name: string | null | undefined, link: string): string {
  const first = name?.trim().split(/\s+/)[0];
  const greeting = first ? `Oi, ${first}!` : "Oi!";
  return `${greeting} Separei um espaço para você conhecer a proposta da STAYO e me contar um pouco sobre o seu imóvel. É rápido e você pode preencher pelo celular: ${link}`;
}
