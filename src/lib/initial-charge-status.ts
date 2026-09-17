import type { InitialChargeStatus } from "../types/admin";

export const initialChargeStatusLabels: Record<InitialChargeStatus, string> = {
  draft: "Rascunho",
  issued: "Emitida",
  pending: "Pendente",
  paid: "Paga",
  cancelled: "Cancelada",
  overdue: "Vencida",
};
