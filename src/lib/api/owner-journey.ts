import type { CommercialProposalSnapshot } from "../../types/commercial-proposal";
import { getSupabasePublicBrowserClient } from "./supabase-client";

/**
 * Proposta vista pelo link de implantação. Vem SEMPRE do snapshot publicado
 * (nunca dos campos editáveis). A confirmação é registrada no servidor por
 * owner_journey_accept_proposal, com versão, snapshot, convite e comando único.
 */
export interface OwnerJourneyVersion {
  proposalId: string;
  version: number;
  status: string;
  publishedAt: string | null;
  snapshot: CommercialProposalSnapshot;
}

export interface OwnerJourneyConfirmation {
  proposalId: string;
  version: number;
  confirmedAt: string;
  confirmedName: string;
  snapshot: CommercialProposalSnapshot;
}

export interface OwnerJourneyProposal {
  current: OwnerJourneyVersion | null;
  confirmation: OwnerJourneyConfirmation | null;
  /** Há versão publicada que ainda não foi confirmada (inclui nova versão). */
  needsConfirmation: boolean;
  /** Itens já pagos marcados pela STAYO (ex.: implementation). */
  paidItems: Record<string, { paid?: boolean; paid_at?: string | null }>;
}

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

function client(): RpcClient {
  const c = getSupabasePublicBrowserClient();
  if (!c) throw new Error("Serviço indisponível.");
  return c as unknown as RpcClient;
}

function parse(data: unknown): OwnerJourneyProposal {
  const d = (data ?? {}) as Partial<OwnerJourneyProposal>;
  return {
    current: d.current ?? null,
    confirmation: d.confirmation ?? null,
    needsConfirmation: Boolean(d.needsConfirmation),
    paidItems: (d.paidItems ?? {}) as OwnerJourneyProposal["paidItems"],
  };
}

export const ownerJourneyApi = {
  resolveProposal: async (token: string): Promise<OwnerJourneyProposal> => {
    const { data, error } = await client().rpc("owner_journey_resolve_proposal", {
      p_token: token,
    });
    if (error) throw new Error(error.message || "Não foi possível carregar a proposta.");
    return parse(data);
  },

  acceptProposal: async (
    token: string,
    acceptedName: string,
    proposalId: string,
    commandId: string,
  ): Promise<OwnerJourneyProposal> => {
    const { data, error } = await client().rpc("owner_journey_accept_proposal", {
      p_token: token,
      p_accepted_name: acceptedName,
      p_proposal_id: proposalId,
      p_command_id: commandId,
    });
    if (error) throw new Error(error.message || "Não foi possível registrar a confirmação.");
    return parse(data);
  },
};
