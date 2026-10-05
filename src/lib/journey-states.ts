import type { ImplementationStatus } from "../types/core";
import type { CommercialProposalStatus } from "../types/commercial-proposal";
import { statusLabels } from "./implementation-status";

/**
 * Três estados independentes: proposta, contrato e implantação.
 * Um nunca é inferido do outro (proposta publicada ≠ contrato enviado).
 */

export type ProposalStage = "nenhuma" | "rascunho" | "publicada" | "aceita";

export function proposalStage(
  versions: Array<{ status: CommercialProposalStatus }>,
): ProposalStage {
  const live = versions.filter((v) => v.status !== "superseded");
  if (live.some((v) => v.status === "accepted")) return "aceita";
  if (live.some((v) => v.status === "published")) return "publicada";
  if (live.some((v) => v.status === "draft")) return "rascunho";
  return "nenhuma";
}

export const proposalStageLabel: Record<ProposalStage, string> = {
  nenhuma: "Proposta não criada",
  rascunho: "Proposta em rascunho",
  publicada: "Proposta publicada",
  aceita: "Proposta aceita",
};

/**
 * Não existe registro de contrato (minuta, envio ou assinatura) no sistema.
 * Condições comerciais registradas não são um contrato gerado.
 */
export type ContractStage = "nao_gerado";
export const contractStageLabel: Record<ContractStage, string> = { nao_gerado: "Não gerado" };
export const currentContractStage = (): ContractStage => "nao_gerado";

const COMMERCIAL: ImplementationStatus[] = ["prospect", "proposta", "aguardando_aprovacao"];

/**
 * Rótulo único usado na lista, no cabeçalho e no cadastro guiado.
 * Na fase comercial, reflete o cadastro e a proposta reais; depois disso,
 * a etapa da implantação gravada no banco.
 */
export function journeyLabel(input: {
  status: ImplementationStatus;
  isDraft: boolean;
  proposal: ProposalStage;
}): string {
  if (!COMMERCIAL.includes(input.status)) return statusLabels[input.status];
  if (input.isDraft) return "Rascunho";
  if (input.proposal !== "nenhuma") return proposalStageLabel[input.proposal];
  return statusLabels[input.status];
}

export function isDraftOrigin(origin: string | null | undefined, completedAt: string | null | undefined) {
  return /^admin_(draft|opportunity):/.test(origin ?? "") && !completedAt;
}
