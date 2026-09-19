import type { OwnerRecord, OwnerTask } from "../types/admin";
import type { ImplementationProject, Property } from "../types/core";

export type OwnerWorkspaceStatus = "Ativo" | "Em implantação" | "Cadastro pendente";

export function deriveOwnerWorkspaceStatus(
  owner: OwnerRecord,
  properties: Property[],
  implementations: ImplementationProject[],
): OwnerWorkspaceStatus {
  if (owner.lifecycleStatus === "ativo" || properties.length > 0) return "Ativo";
  if (implementations.some((item) => !["cancelado", "nao_convertido"].includes(item.status))) {
    return "Em implantação";
  }
  return "Cadastro pendente";
}

export function ownerRegistrationStatus(params: {
  hasSubmittedProfile: boolean;
  hasPayoutAccount: boolean;
  hasDocuments: boolean;
  hasContract: boolean;
}) {
  const complete = Object.values(params).filter(Boolean).length;
  return { complete, total: 4, label: complete === 4 ? "Completo" : `${complete}/4` };
}

export function pendingOwnerTasks(tasks: OwnerTask[]) {
  return tasks.filter((task) => task.status === "pending");
}

export function maskPixKey(value: string | null): string {
  if (!value) return "—";
  const visible = value.slice(-4);
  return `${"•".repeat(Math.min(Math.max(value.length - 4, 4), 10))}${visible}`;
}