import type { ImplementationProject } from "../types/core";

export type OwnerPortalPhase = "implementation" | "ready" | "operation";
export type OwnerPortalModule =
  | "overview"
  | "implementation"
  | "profile"
  | "proposal"
  | "reservations"
  | "calendar"
  | "property"
  | "inspections"
  | "maintenance"
  | "finance"
  | "documents";

const implementationModules: OwnerPortalModule[] = [
  "overview",
  "implementation",
  "property",
  "inspections",
  "profile",
  "proposal",
  "documents",
];

const operationModules: OwnerPortalModule[] = [
  "overview",
  "reservations",
  "calendar",
  "property",
  "inspections",
  "maintenance",
  "finance",
  "documents",
  "implementation",
];

/**
 * A área operacional só existe após a ativação controlada: implantação "ativo"
 * E vínculo oficial com owner + Property do STAYO APP/Core. Sem isso, nunca
 * mostramos "Em operação" — nem por status isolado, nem pelo convite inicial.
 */
export function isOperationallyActivated(
  implementation:
    Pick<ImplementationProject, "status" | "corePropertyId" | "coreOwnerId"> | undefined,
): boolean {
  return Boolean(
    implementation?.status === "ativo" &&
    implementation.corePropertyId &&
    implementation.coreOwnerId,
  );
}

export function getOwnerPortalPhase(
  implementation:
    Pick<ImplementationProject, "status" | "corePropertyId" | "coreOwnerId"> | undefined,
): OwnerPortalPhase {
  if (isOperationallyActivated(implementation)) return "operation";
  if (implementation?.status === "pronto_para_operacao" || implementation?.status === "ativo")
    return "ready";
  return "implementation";
}

export function getOwnerPortalModules(phase: OwnerPortalPhase): OwnerPortalModule[] {
  return phase === "operation" ? operationModules : implementationModules;
}
