import type { CommercialTerm } from "../../types/admin";
import type { Proposal, ProposalItem } from "../../types/core";
import { createDefaultAdminApiClient } from "./admin-client";
import { proposalsStore } from "./local-store";
import { getSupabasePublicBrowserClient, isSupabaseConfigured } from "./supabase-client";

export interface OwnerJourneyContractConditions {
  administrationFee: number | null;
  cleaningResponsibility: string | null;
  payoutRule: string | null;
  maintenanceLimit: number | null;
  exclusivity: boolean | null;
  durationMonths: number | null;
  noticePeriodDays: number | null;
}

export interface OwnerJourneyProposal {
  proposal: Proposal;
  commercialTerms: CommercialTerm[];
  contractConditions: OwnerJourneyContractConditions | null;
}

type RpcError = { message?: string; code?: string };
type UntypedRpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: RpcError | null }>;
};

type JourneyRow = {
  proposal_id: string;
  implementation_id: string;
  version: number;
  items: ProposalItem[];
  total: number | string;
  accepted_at: string | null;
  accepted_name: string | null;
  created_at: string;
  commercial_terms: Array<{
    id: string;
    label: string;
    chargeType: CommercialTerm["chargeType"];
    value: number | string;
    optional: boolean;
    displayOrder: number;
    notes: string | null;
  }> | null;
  contract_conditions: {
    administration_fee?: number | string | null;
    cleaning_responsibility?: string | null;
    payout_rule?: string | null;
    maintenance_limit?: number | string | null;
    exclusivity?: boolean | null;
    duration_months?: number | null;
    notice_period_days?: number | null;
  } | null;
};

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstRow(value: unknown): JourneyRow | null {
  if (Array.isArray(value)) return (value[0] as JourneyRow | undefined) ?? null;
  if (value && typeof value === "object") return value as JourneyRow;
  return null;
}

function mapRow(row: JourneyRow): OwnerJourneyProposal {
  const conditions = row.contract_conditions;
  return {
    proposal: {
      id: row.proposal_id,
      implementationId: row.implementation_id,
      version: row.version,
      items: row.items ?? [],
      total: Number(row.total),
      acceptedAt: row.accepted_at,
      acceptedName: row.accepted_name,
      createdAt: row.created_at,
    },
    commercialTerms: (row.commercial_terms ?? []).map((term) => ({
      id: term.id,
      implementationId: row.implementation_id,
      label: term.label,
      chargeType: term.chargeType,
      value: Number(term.value),
      optional: term.optional,
      displayOrder: term.displayOrder,
      notes: term.notes,
    })),
    contractConditions: conditions
      ? {
          administrationFee: numberOrNull(conditions.administration_fee),
          cleaningResponsibility: conditions.cleaning_responsibility ?? null,
          payoutRule: conditions.payout_rule ?? null,
          maintenanceLimit: numberOrNull(conditions.maintenance_limit),
          exclusivity: conditions.exclusivity ?? null,
          durationMonths: conditions.duration_months ?? null,
          noticePeriodDays: conditions.notice_period_days ?? null,
        }
      : null,
  };
}

function publicRpcClient(): UntypedRpcClient | null {
  const client = getSupabasePublicBrowserClient();
  return client ? (client as unknown as UntypedRpcClient) : null;
}

async function resolveFromSupabase(token: string): Promise<OwnerJourneyProposal | null> {
  const client = publicRpcClient();
  if (!client) return null;
  const { data, error } = await client.rpc("owner_journey_resolve_proposal", { p_token: token });
  if (error) {
    // Enquanto a migration 0016 ainda não foi aplicada no ambiente remoto,
    // a UI deve mostrar um estado honesto e não inventar uma proposta.
    if (error.code === "PGRST202" || error.message?.includes("owner_journey_resolve_proposal")) {
      return null;
    }
    throw new Error(error.message || "Não foi possível carregar a proposta.");
  }
  const row = firstRow(data);
  return row ? mapRow(row) : null;
}

async function acceptInSupabase(token: string, acceptedName: string): Promise<OwnerJourneyProposal> {
  const client = publicRpcClient();
  if (!client) throw new Error("Supabase não configurado");
  const { data, error } = await client.rpc("owner_journey_accept_proposal", {
    p_token: token,
    p_accepted_name: acceptedName,
  });
  if (error) throw new Error(error.message || "Não foi possível registrar o aceite.");
  const row = firstRow(data);
  if (!row) throw new Error("A proposta vinculada não foi encontrada.");
  return mapRow(row);
}

/**
 * Fallback exclusivamente local para desenvolvimento sem Supabase. Em
 * produção a versão fica congelada em owner_portal_invitations.proposal_id.
 */
async function resolveLocal(token: string): Promise<OwnerJourneyProposal | null> {
  const adminApi = createDefaultAdminApiClient();
  const invitation = await adminApi.ownerOnboarding.findByToken(token);
  if (!invitation) return null;
  const proposals = await proposalsStore.list(invitation.implementationId);
  const proposal = proposals[0];
  if (!proposal) return null;
  const commercialTerms = await adminApi.commercialTerms.listByImplementation(
    invitation.implementationId,
  );
  return { proposal, commercialTerms, contractConditions: null };
}

export const ownerJourneyApi = {
  resolveProposal: async (token: string): Promise<OwnerJourneyProposal | null> =>
    isSupabaseConfigured() ? resolveFromSupabase(token) : resolveLocal(token),

  acceptProposal: async (token: string, acceptedName: string): Promise<OwnerJourneyProposal> => {
    if (isSupabaseConfigured()) return acceptInSupabase(token, acceptedName);
    const journey = await resolveLocal(token);
    if (!journey) throw new Error("Proposta não encontrada.");
    const accepted = await proposalsStore.accept(journey.proposal.id, acceptedName);
    if (!accepted) throw new Error("Proposta não encontrada.");
    return { ...journey, proposal: accepted };
  },
};
