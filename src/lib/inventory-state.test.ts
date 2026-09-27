import { describe, expect, it } from "vitest";

import {
  inventoryMissingQuantity,
  inventoryStateLabel,
  isInventoryBlocker,
  isInventoryMissing,
  isInventoryResolved,
  matchesInventoryFilter,
  type InventoryStateItem,
} from "./inventory-state";

const item = (overrides: Partial<InventoryStateItem> = {}): InventoryStateItem => ({
  module: "enxoval",
  required_qty: 1,
  existing_qty: 0,
  status: "pendente",
  blocks_readiness: false,
  ...overrides,
});

describe("inventory state", () => {
  it("considera completo quando possui tudo que é necessário", () => {
    const complete = item({ required_qty: 6, existing_qty: 6 });
    expect(inventoryMissingQuantity(complete)).toBe(0);
    expect(isInventoryResolved(complete)).toBe(true);
    expect(isInventoryMissing(complete)).toBe(false);
    expect(inventoryStateLabel(complete)).toBe("Completo");
  });

  it("calcula item parcial pela diferença necessário - possui", () => {
    const partial = item({ required_qty: 6, existing_qty: 4 });
    expect(inventoryMissingQuantity(partial)).toBe(2);
    expect(isInventoryMissing(partial)).toBe(true);
    expect(inventoryStateLabel(partial)).toBe("Falta 2");
  });

  it("mantém item totalmente faltante no mesmo domínio", () => {
    const missing = item({ required_qty: 3, existing_qty: 0 });
    expect(inventoryMissingQuantity(missing)).toBe(3);
    expect(matchesInventoryFilter(missing, "faltando")).toBe(true);
    expect(matchesInventoryFilter(missing, "resolvidos")).toBe(false);
  });

  it("só trata bloqueador como ativo enquanto o item estiver faltando", () => {
    expect(isInventoryBlocker(item({ blocks_readiness: true }))).toBe(true);
    expect(
      isInventoryBlocker(item({ blocks_readiness: true, required_qty: 1, existing_qty: 1 })),
    ).toBe(false);
  });

  it("preserva pendência manual e permite resolvê-la pela quantidade", () => {
    const manual = item({ module: "faltante", required_qty: 1, existing_qty: 0 });
    expect(isInventoryMissing(manual)).toBe(true);
    expect(inventoryStateLabel(manual)).toBe("Falta 1");

    const resolvedManual = { ...manual, existing_qty: 1 };
    expect(isInventoryResolved(resolvedManual)).toBe(true);
    expect(inventoryStateLabel(resolvedManual)).toBe("Completo");
  });

  it("recalcula ao alterar quantidade existente e necessária", () => {
    const base = item({ required_qty: 4, existing_qty: 1 });
    expect(inventoryMissingQuantity(base)).toBe(3);
    expect(inventoryMissingQuantity({ ...base, existing_qty: 3 })).toBe(1);
    expect(inventoryMissingQuantity({ ...base, required_qty: 1 })).toBe(0);
  });

  it("filtra todos, faltando, resolvidos e bloqueadores", () => {
    const missing = item();
    const resolved = item({ existing_qty: 1 });
    const blocker = item({ blocks_readiness: true });

    expect(matchesInventoryFilter(missing, "todos")).toBe(true);
    expect(matchesInventoryFilter(missing, "faltando")).toBe(true);
    expect(matchesInventoryFilter(resolved, "resolvidos")).toBe(true);
    expect(matchesInventoryFilter(blocker, "bloqueadores")).toBe(true);
    expect(matchesInventoryFilter(resolved, "bloqueadores")).toBe(false);
  });

  it("mantém instalado e não aplicável como resolvidos", () => {
    expect(isInventoryResolved(item({ status: "instalado" }))).toBe(true);
    expect(isInventoryResolved(item({ status: "nao_aplicavel" }))).toBe(true);
  });
});
