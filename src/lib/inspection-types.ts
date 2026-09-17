import type { InspectionType } from "../types/core";

export const inspectionTypeLabels: Record<InspectionType, string> = {
  implantacao: "Implantação",
  entrada: "Entrada",
  saida: "Saída",
  periodica: "Periódica",
  manutencao: "Manutenção",
  inventario: "Inventário",
};
