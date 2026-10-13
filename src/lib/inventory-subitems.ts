/** Subitens que abrem embaixo da linha principal para marcar Sim/Não um a um. */
import { amenityDisplayKey } from "./inventory-amenities-view";

export interface InventorySubItem {
  key: string;
  label: string;
}

/** Chave = amenityDisplayKey do item principal. */
export const INVENTORY_SUBITEMS: Record<string, InventorySubItem[]> = {
  jogo_de_jantar: [
    { key: "prato_de_sobremesa", label: "Prato de sobremesa" },
    { key: "prato_fundo", label: "Prato fundo" },
    { key: "prato_raso", label: "Prato raso" },
    { key: "souplast", label: "Souplast" },
  ],
};

export function inventorySubItemsFor(name: string): InventorySubItem[] {
  return INVENTORY_SUBITEMS[amenityDisplayKey(name)] ?? [];
}

export type InventorySubAnswers = Record<string, "tenho" | "nao_tenho" | null>;

export function subAnswerFor(
  subanswers: InventorySubAnswers | null | undefined,
  key: string,
): "tenho" | "nao_tenho" | null {
  return subanswers?.[key] ?? null;
}

/** Mescla mantendo as outras respostas; remove a chave quando a resposta volta a nulo. */
export function mergeSubAnswer(
  subanswers: InventorySubAnswers | null | undefined,
  key: string,
  answer: "tenho" | "nao_tenho" | null,
): InventorySubAnswers | null {
  const next: InventorySubAnswers = { ...(subanswers ?? {}) };
  if (answer) next[key] = answer;
  else delete next[key];
  return Object.keys(next).length ? next : null;
}
