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

export function getOwnerPortalPhase(
  implementation: Pick<ImplementationProject, "status" | "corePropertyId"> | undefined,
): OwnerPortalPhase {
  if (implementation?.status === "ativo" && implementation.corePropertyId) return "operation";
  if (implementation?.status === "pronto_para_operacao" || implementation?.status === "ativo") return "ready";
  return "implementation";
}

export function getOwnerPortalModules(phase: OwnerPortalPhase): OwnerPortalModule[] {
  return phase === "operation" ? operationModules : implementationModules;
}