/**
 * Visibilidade no portal do proprietário.
 * Um bloco só existe para o proprietário quando há uma liberação ativa em
 * `portal_visibility_releases` (RLS). Liberar e ocultar passam por RPCs que
 * registram quem e quando. Conteúdo sensível (acesso, Wi-Fi, códigos, dados
 * bancários, notas internas) não é elegível.
 */
import { getSupabaseBrowserClient } from "./supabase-client";
import type { CommercialProposalSnapshot } from "../../types/commercial-proposal";

export type PortalBlock = "overview" | "proposal" | "documents";

export interface OverviewContent {
  title: string;
  message: string;
  nextStep: string | null;
}
export interface ProposalContent {
  proposalId: string;
  snapshot: CommercialProposalSnapshot;
}
export interface ReleasedDocument {
  attachmentId: string;
  filename: string;
  mimeType: string;
  category: string;
  createdAt: string;
}
export interface DocumentsContent {
  documents: ReleasedDocument[];
}

export interface PortalRelease {
  id: string;
  block: PortalBlock;
  content: OverviewContent | ProposalContent | DocumentsContent;
  releasedByName: string | null;
  releasedAt: string;
}

export const blockLabel: Record<PortalBlock, string> = {
  overview: "Resumo da implantação",
  proposal: "Proposta",
  documents: "Documentos",
};

function client() {
  const c = getSupabaseBrowserClient();
  if (!c) throw new Error("Banco indisponível.");
  return c;
}

export async function listActiveReleases(implementationId: string): Promise<PortalRelease[]> {
  const { data, error } = await client()
    .from("portal_visibility_releases")
    .select("id, block, content, released_by_name, released_at")
    .eq("implementation_id", implementationId)
    .is("revoked_at", null);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    block: r.block as PortalBlock,
    content: r.content as unknown as PortalRelease["content"],
    releasedByName: r.released_by_name,
    releasedAt: r.released_at,
  }));
}

export async function releaseBlock(input: {
  implementationId: string;
  block: PortalBlock;
  content: Record<string, unknown>;
}) {
  const { error } = await client().rpc("admin_release_portal_block", { p_data: input as never });
  if (error) throw error;
}

export async function hideBlock(implementationId: string, block: PortalBlock) {
  const { error } = await client().rpc("admin_hide_portal_block", {
    p_implementation_id: implementationId,
    p_block: block,
  });
  if (error) throw error;
}
