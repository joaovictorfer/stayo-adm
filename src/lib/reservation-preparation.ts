export const preparationItems = [
  { key: "limpeza", label: "Limpeza" }, { key: "kit", label: "Kit" },
  { key: "enxoval", label: "Enxoval" }, { key: "vistoria", label: "Vistoria" },
  { key: "condominio", label: "Condomínio" },
] as const;
export type PreparationItem = typeof preparationItems[number]["key"];
export type PreparationRecord = { reservation_id: string; item: string; checked: boolean };
export function preparationState(rows: PreparationRecord[], reservationId: string) {
  const checked = new Set(rows.filter((r) => r.reservation_id === reservationId && r.checked).map((r) => r.item));
  const count = preparationItems.filter((i) => checked.has(i.key)).length;
  return { checked, count, ready: count === 5 };
}