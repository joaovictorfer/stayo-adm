import { z } from "zod";

import type {
  CommercialProposalSnapshot,
  ProposalRequiredSignatory,
  ProposalSnapshotContractConditions,
} from "../../types/commercial-proposal";
import { getSupabasePublicBrowserClient } from "./supabase-client";

const proposalItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitValue: z.number(),
  discount: z.number(),
  total: z.number(),
});

const commercialTermSchema = z.object({
  label: z.string(),
  chargeType: z.string(),
  value: z.number(),
  optional: z.boolean(),
  displayOrder: z.number(),
  notes: z.string().nullable(),
});

const contractConditionsSchema = z
  .object({
    administrationFee: z.number().nullable().optional(),
    cleaningResponsibility: z.string().nullable().optional(),
    payoutRule: z.string().nullable().optional(),
    maintenanceLimit: z.number().nullable().optional(),
    exclusivity: z.boolean().nullable().optional(),
    durationMonths: z.number().nullable().optional(),
    noticePeriodDays: z.number().nullable().optional(),
  })
  .transform((value): ProposalSnapshotContractConditions => {
    const result: ProposalSnapshotContractConditions = {};
    if (value.administrationFee !== undefined) result.administrationFee = value.administrationFee;
    if (value.cleaningResponsibility !== undefined)
      result.cleaningResponsibility = value.cleaningResponsibility;
    if (value.payoutRule !== undefined) result.payoutRule = value.payoutRule;
    if (value.maintenanceLimit !== undefined) result.maintenanceLimit = value.maintenanceLimit;
    if (value.exclusivity !== undefined) result.exclusivity = value.exclusivity;
    if (value.durationMonths !== undefined) result.durationMonths = value.durationMonths;
    if (value.noticePeriodDays !== undefined) result.noticePeriodDays = value.noticePeriodDays;
    return result;
  });

const contentBlockSchema = z.object({
  title: z.string(),
  body: z.string(),
  displayOrder: z.number(),
});

const requiredSignatorySchema = z
  .object({
    label: z.string(),
    role: z.string().nullable().optional(),
  })
  .transform((value): ProposalRequiredSignatory =>
    value.role === undefined ? { label: value.label } : { label: value.label, role: value.role },
  );

const publicProposalSnapshotSchema = z.object({
  schemaVersion: z.number(),
  proposalId: z.string().min(1),
  implementationId: z.string().min(1),
  version: z.number(),
  opportunity: z.object({
    code: z.string(),
    title: z.string().nullable(),
  }),
  items: z.array(proposalItemSchema),
  total: z.number(),
  commercialTerms: z.array(commercialTermSchema),
  contractConditions: contractConditionsSchema,
  responsibilities: z.array(z.string()),
  content: z.array(contentBlockSchema),
  requiredSignatories: z.array(requiredSignatorySchema),
  publishedAt: z.string().min(1),
});

export class PublicProposalTransportError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PublicProposalTransportError";
  }
}

/**
 * Valida e reduz a resposta da RPC ao contrato público conhecido pela UI.
 * `z.object` remove chaves desconhecidas, então um campo futuro do backend
 * nunca passa a ser renderizável por acidente sem alteração explícita aqui.
 */
export function parsePublicProposalSnapshot(value: unknown): CommercialProposalSnapshot {
  const parsed = publicProposalSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    throw new PublicProposalTransportError(
      "A resposta pública da proposta não corresponde ao contrato esperado.",
    );
  }
  return parsed.data;
}

/**
 * Resolve somente a apresentação pública criada pela migration 0023.
 * Usa um client anônimo sem sessão persistida e não consulta tabelas internas.
 * `null` significa link inválido, expirado, revogado, draft, sem snapshot ou
 * token de outro domínio (como onboarding), conforme o contrato da RPC.
 */
export async function resolvePublicProposalByToken(
  token: string,
): Promise<CommercialProposalSnapshot | null> {
  const normalizedToken = token.trim();
  if (!normalizedToken) return null;

  const client = getSupabasePublicBrowserClient();
  if (!client) {
    throw new PublicProposalTransportError("O serviço público da proposta não está configurado.");
  }

  try {
    const { data, error } = await client.rpc("proposal_public_resolve_by_token", {
      p_token: normalizedToken,
    });

    if (error) {
      throw new PublicProposalTransportError("Não foi possível consultar a proposta.", {
        cause: error,
      });
    }

    if (data === null) return null;
    return parsePublicProposalSnapshot(data);
  } catch (error) {
    if (error instanceof PublicProposalTransportError) throw error;
    throw new PublicProposalTransportError("Não foi possível consultar a proposta.", {
      cause: error,
    });
  }
}
