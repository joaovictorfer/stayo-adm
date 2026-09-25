import type { ImplementationProject } from "../types/core";

export function opportunityTitle(
  value: Pick<ImplementationProject, "nickname" | "condominiumName" | "unit" | "code">,
): string {
  if (value.nickname?.trim()) return value.nickname.trim();
  const property = [value.condominiumName, value.unit].filter(Boolean).join(" · ");
  return property || `Oportunidade ${value.code}`;
}

export function isLightOpportunity(
  value: Pick<
    ImplementationProject,
    "status" | "condominiumId" | "condominiumName" | "unit" | "address" | "corePropertyId"
  >,
): boolean {
  return (
    value.status === "prospect" &&
    !value.condominiumId &&
    !value.condominiumName &&
    !value.unit &&
    !value.address &&
    !value.corePropertyId
  );
}

/** Oportunidade criada pelo caminho "Convidar proprietário" e ainda sem proprietário. */
export function isInviteOpportunity(
  value: Partial<Pick<ImplementationProject, "origin" | "ownerId">>,
): boolean {
  return !value.ownerId && Boolean(value.origin?.startsWith("admin_invite:"));
}

export function opportunityNextAction(
  value: Pick<
    ImplementationProject,
    "status" | "condominiumId" | "condominiumName" | "unit" | "address" | "corePropertyId"
  > &
    Partial<Pick<ImplementationProject, "origin" | "ownerId">>,
): string {
  if (value.status === "prospect") {
    if (isInviteOpportunity(value)) return "Convite a preparar";
    return isLightOpportunity(value) ? "Completar dados ou preparar proposta" : "Preparar proposta";
  }
  if (value.status === "proposta") return "Revisar proposta";
  if (value.status === "aguardando_aprovacao") return "Aguardar retorno do proprietário";
  if (value.status === "aprovado") return "Planejar implantação";
  if (value.status === "planejamento" || value.status === "em_implantacao") {
    return "Continuar implantação";
  }
  if (value.status === "validacao") return "Validar prontidão";
  if (value.status === "pronto_para_operacao") return "Preparar ativação";
  if (value.status === "ativo") return "Acompanhar operação";
  if (value.status === "pausado") return "Revisar pausa";
  if (value.status === "nao_convertido") return "Revisar oportunidade";
  return "Sem próxima ação definida";
}
