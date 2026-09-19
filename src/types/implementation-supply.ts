/**
 * Fase 4 — enxoval e itens faltantes da implantação.
 *
 * Nenhuma lista de itens é fixa no código: tudo é cadastrado pela interface
 * e pode ser salvo como template reaplicável. O "faltante" nunca é digitado:
 * é sempre calculado (necessário − existente).
 */

export type SupplyModule = "enxoval" | "faltante";

export const supplyModuleLabels: Record<SupplyModule, string> = {
  enxoval: "Enxoval",
  faltante: "Itens faltantes",
};

export type SupplyStatus = "pendente" | "comprado" | "entregue" | "instalado" | "nao_aplicavel";

export const supplyStatusLabels: Record<SupplyStatus, string> = {
  pendente: "Pendente",
  comprado: "Comprado",
  entregue: "Entregue",
  instalado: "Instalado",
  nao_aplicavel: "Não aplicável",
};

export type SupplyPriority = "baixa" | "media" | "alta";

export const supplyPriorityLabels: Record<SupplyPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export interface SupplyItem {
  id: string;
  implementationId: string;
  module: SupplyModule;
  name: string;
  room: string | null;
  size: string | null;
  requiredQty: number;
  existingQty: number;
  status: SupplyStatus;
  priority: SupplyPriority;
  responsible: string | null;
  blocksReadiness: boolean;
  notes: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplyItemInput {
  implementationId: string;
  module: SupplyModule;
  name: string;
  room?: string | null;
  size?: string | null;
  requiredQty?: number;
  existingQty?: number;
  status?: SupplyStatus;
  priority?: SupplyPriority;
  responsible?: string | null;
  blocksReadiness?: boolean;
  notes?: string | null;
  displayOrder?: number;
}

export interface SupplyItemPatch {
  name?: string;
  room?: string | null;
  size?: string | null;
  requiredQty?: number;
  existingQty?: number;
  status?: SupplyStatus;
  priority?: SupplyPriority;
  responsible?: string | null;
  blocksReadiness?: boolean;
  notes?: string | null;
  displayOrder?: number;
}

export interface SupplyTemplate {
  id: string;
  name: string;
  module: SupplyModule;
  notes: string | null;
  createdAt: string;
}

export interface SupplyTemplateItem {
  id: string;
  templateId: string;
  name: string;
  room: string | null;
  size: string | null;
  requiredQty: number;
  displayOrder: number;
}

export interface SupplyTemplateInput {
  name: string;
  module: SupplyModule;
  notes?: string | null;
  items: Array<Omit<SupplyTemplateItem, "id" | "templateId">>;
}

/** Faltante é sempre derivado, nunca digitado. */
export function missingQty(item: Pick<SupplyItem, "requiredQty" | "existingQty">): number {
  return Math.max(0, item.requiredQty - item.existingQty);
}

/** Item ainda em aberto: falta quantidade e não foi marcado como resolvido. */
export function isSupplyOpen(item: SupplyItem): boolean {
  if (item.status === "instalado" || item.status === "nao_aplicavel") return false;
  return missingQty(item) > 0 || item.status === "pendente";
}

/** Itens em aberto marcados como bloqueio entram na prontidão operacional. */
export function blockingSupplyItems(items: SupplyItem[]): SupplyItem[] {
  return items.filter((item) => item.blocksReadiness && isSupplyOpen(item));
}
