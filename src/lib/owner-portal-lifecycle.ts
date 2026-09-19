import type { ImplementationStatus } from "../types/core";
import type { OwnerPortalModule, OwnerPortalSnapshot, OwnerPortalStage } from "../types/owner-portal";

const IMPLEMENTATION_MODULES: OwnerPortalModule[] = [
  "overview",
  "implementation",
  "profile",
  "proposal",
  "documents",
];

const ACTIVE_MODULES: OwnerPortalModule[] = [
  "overview",
  "reservations",
  "calendar",
  "property",
  "inspections",
  "maintenance",
  "financial",
  "documents",
];

export function ownerPortalStage(
  status: ImplementationStatus,
  corePropertyId: string | null,
): OwnerPortalStage {
  if (status === "ativo" && corePropertyId) return "active";
  if (status === "pronto_para_operacao" || status === "ativo") return "ready";
  return "implementation";
}

export function availableOwnerPortalModules(snapshot: OwnerPortalSnapshot): OwnerPortalModule[] {
  return ownerPortalStage(snapshot.status, snapshot.corePropertyId ?? null) === "active"
    ? ACTIVE_MODULES
    : IMPLEMENTATION_MODULES;
}

export function isOwnerPortalModuleAvailable(
  snapshot: OwnerPortalSnapshot,
  module: OwnerPortalModule,
): boolean {
  return availableOwnerPortalModules(snapshot).includes(module);
}