import { describe, expect, it } from "vitest";
import {
  deriveInventoryState,
  filterInventory,
  hasOpenInventoryDuplicate,
  type InventoryItem,
} from "./inventory";

const item = (patch: Partial<InventoryItem> = {}): InventoryItem => ({
  id: "item-1",
  module: "enxoval",
  name: "Cafeteira",
  room: "Cozinha",
  size: null,
  required_qty: 1,
  existing_qty: 0,
  status: "pendente",
  priority: "media",
  responsible: "stayo",
  blocks_readiness: false,
  notes: null,
  ...patch,
});

describe("inventário unificado", () => {
  it("deriva completo, parcial e faltante pelas quantidades", () => {
    expect(deriveInventoryState(item({ existing_qty: 1 })).resolved).toBe(true);
    expect(deriveInventoryState(item({ required_qty: 6, existing_qty: 4 })).missingQty).toBe(2);
    expect(deriveInventoryState(item()).missingQty).toBe(1);
  });
  it("mantém pendência manual no mesmo domínio", () => {
    expect(deriveInventoryState(item({ module: "faltante" })).origin).toBe("manual");
    expect(deriveInventoryState(item({ module: "faltante", status: "instalado" })).resolved).toBe(
      true,
    );
  });
  it("só considera bloqueador enquanto estiver faltando", () => {
    expect(deriveInventoryState(item({ blocks_readiness: true })).blocker).toBe(true);
    expect(deriveInventoryState(item({ blocks_readiness: true, existing_qty: 1 })).blocker).toBe(
      false,
    );
  });
  it("reflete mudanças nas quantidades", () => {
    expect(deriveInventoryState(item({ required_qty: 2, existing_qty: 2 })).resolved).toBe(true);
    expect(deriveInventoryState(item({ required_qty: 3, existing_qty: 2 })).missingQty).toBe(1);
  });
  it("filtra todos, faltando, resolvidos e bloqueadores", () => {
    const rows = [
      item(),
      item({ id: "2", name: "TV", existing_qty: 1 }),
      item({ id: "3", name: "Ar", blocks_readiness: true }),
    ];
    expect(filterInventory(rows, "todos")).toHaveLength(3);
    expect(filterInventory(rows, "faltando")).toHaveLength(2);
    expect(filterInventory(rows, "resolvidos")).toHaveLength(1);
    expect(filterInventory(rows, "bloqueadores").map((row) => row.item.id)).toEqual(["3"]);
  });
  it("impede outra pendência aberta com nome e ambiente equivalentes", () => {
    const rows = [item({ name: "Ar condicionado", room: "Suíte" })];
    expect(hasOpenInventoryDuplicate(rows, " ar  condicionado ", "Suite")).toBe(true);
    expect(hasOpenInventoryDuplicate(rows, "Ar condicionado", "Sala")).toBe(false);
  });
  it("aceita dispensa explícita sem fabricar quantidade", () => {
    const state = deriveInventoryState(item({ status: "nao_aplicavel", existing_qty: 0 }));
    expect(state.resolved).toBe(true);
    expect(state.missingQty).toBe(0);
  });
});
