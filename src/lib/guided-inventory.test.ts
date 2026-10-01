import { describe, expect, it } from "vitest";
import { buildSnapshot, groupByRoom, type InventoryCatalogItem } from "./guided-inventory";

const catalog = (): InventoryCatalogItem[] => [
  { id: "c1", room: "cozinha", category: "Utensílios", name: "Forma de pizza", display_order: 10, active: true, tip: null },
  { id: "c2", room: "sala", category: "Móveis", name: "Sofá", display_order: 10, active: true, tip: null },
  { id: "c3", room: "sala", category: "Móveis", name: "Pufe", display_order: 20, active: false, tip: null },
];
let n = 0;
const id = () => `s${++n}`;

describe("inventário guiado — snapshot", () => {
  it("copia só itens ativos com ambiente", () => {
    const s = buildSnapshot("A", catalog(), [], id);
    expect(s.map((i) => i.catalog_item_id)).toEqual(["c1", "c2"]);
    expect(s.every((i) => i.implementation_id === "A" && i.room)).toBe(true);
  });
  it("é idempotente", () => {
    const first = buildSnapshot("A", catalog(), [], id);
    expect(buildSnapshot("A", catalog(), first, id)).toHaveLength(0);
  });
  it("mudança no modelo não altera snapshot existente", () => {
    const cat = catalog();
    const snap = buildSnapshot("A", cat, [], id);
    cat[0]!.name = "Forma de pizza (novo)";
    expect(snap[0]!.name).toBe("Forma de pizza");
  });
  it("isola duas implantações", () => {
    const cat = catalog();
    const a = buildSnapshot("A", cat, [], id);
    const b = buildSnapshot("B", cat, [], id);
    a[0]!.name = "Forma de pizza pequena";
    expect(b[0]!.name).toBe("Forma de pizza");
    expect(new Set([...a, ...b].map((i) => i.id)).size).toBe(4);
  });
  it("agrupa por ambiente na ordem padrão", () => {
    expect(groupByRoom(buildSnapshot("A", catalog(), [], id)).map((g) => g.key)).toEqual(["cozinha", "sala"]);
  });
});

import { buildDuplicate, inventoryOriginLabel } from "./guided-inventory";
describe("duplicação do inventário", () => {
  const src = { id: "a", implementation_id: "imp1", catalog_item_id: "cat1", room: "cozinha" as const, category: "Utensílios", name: "Forma de pizza pequena", display_order: 3, enabled: true, tip: null, inventory_answer: "tenho" as const, inventory_brand: "X", inventory_internal_notes: "segredo" };
  it("exige nome novo e diferente", () => {
    expect(() => buildDuplicate(src, "  ", 4)).toThrow();
    expect(() => buildDuplicate(src, "forma de pizza pequena", 4)).toThrow();
  });
  it("mantém ambiente e item-base, sem copiar resposta nem observação", () => {
    const d = buildDuplicate(src, "Forma de pizza grande", 4) as Record<string, unknown>;
    expect(d).toMatchObject({ implementation_id: "imp1", room: "cozinha", catalog_item_id: null, base_catalog_item_id: "cat1", name: "Forma de pizza grande" });
    expect(d['inventory_answer']).toBeUndefined();
    expect(d['inventory_internal_notes']).toBeUndefined();
    expect(d['inventory_brand']).toBeUndefined();
  });
  it("rotula origem", () => {
    expect(inventoryOriginLabel({ catalog_item_id: null, base_catalog_item_id: null, inventory_source: "proprietario" })).toBe("Informado pelo proprietário");
    expect(inventoryOriginLabel({ catalog_item_id: null, base_catalog_item_id: null, inventory_source: "equipe" })).toBe("Adicionado pela equipe");
  });
});
