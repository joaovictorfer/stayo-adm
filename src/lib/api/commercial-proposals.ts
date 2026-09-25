import { getSupabaseBrowserClient } from "./supabase-client";
import type {
  CommercialProposalVersion,
  ProposalDraftInput,
} from "../../types/commercial-proposal";

function client() {
  const value = getSupabaseBrowserClient();
  if (!value) {
    throw new Error(
      "Propostas desconectadas. O banco não está configurado; nenhum dado foi simulado.",
    );
  }
  return value;
}

function commandId(): string {
  return crypto.randomUUID();
}

function proposalFromRpc(value: unknown): CommercialProposalVersion {
  const row = (value ?? {}) as CommercialProposalVersion;
  return {
    ...row,
    items: Array.isArray(row.items) ? row.items : [],
    draftResponsibilities: Array.isArray(row.draftResponsibilities)
      ? row.draftResponsibilities
      : [],
    requiredSignatories: Array.isArray(row.requiredSignatories) ? row.requiredSignatories : [],
    draftItemOptions: Array.isArray(row.draftItemOptions) ? row.draftItemOptions : undefined,
    snapshot: row.snapshot ?? null,
  };
}

export const commercialProposalsApi = {
  async list(implementationId: string): Promise<CommercialProposalVersion[]> {
    const { data, error } = await client().rpc("admin_list_proposal_versions", {
      p_implementation_id: implementationId,
    });
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map(proposalFromRpc);
  },

  async saveDraft(input: ProposalDraftInput): Promise<CommercialProposalVersion> {
    const { data, error } = await client().rpc("admin_save_proposal_draft", {
      p_data: {
        proposalId: input.proposalId ?? null,
        implementationId: input.implementationId,
        expectedRevision: input.expectedRevision ?? null,
        items: input.items,
        responsibilities: input.responsibilities,
        requiredSignatories: input.requiredSignatories,
        itemOptions: input.itemOptions ?? [],
        partnershipObject: input.partnershipObject ?? null,
        commandId: input.commandId || commandId(),
      },
    });
    if (error) throw error;
    return proposalFromRpc(data);
  },

  async publish(input: {
    proposalId: string;
    expectedRevision: number;
    commandId?: string;
  }): Promise<CommercialProposalVersion> {
    const { data, error } = await client().rpc("admin_publish_proposal", {
      p_data: {
        proposalId: input.proposalId,
        expectedRevision: input.expectedRevision,
        commandId: input.commandId ?? commandId(),
      },
    });
    if (error) throw error;
    return proposalFromRpc(data);
  },
};
