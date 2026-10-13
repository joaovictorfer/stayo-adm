import { describe, expect, it } from "vitest";
import { amenityDisplayKey, matchingInventoryItem } from "./inventory-amenities-view";
import type { InventorySnapshotItem } from "./guided-inventory";

describe("associação visual de comodidades ao inventário", () => {
  it("associa Air fryer ao item Airfryer existente", () => {
    const item: InventorySnapshotItem = { id: "air", implementation_id: "A", catalog_item_id: null, room: "cozinha", category: "Itens", name: "Airfryer", display_order: 1, enabled: true, tip: null };
    expect(matchingInventoryItem([item], "Air fryer")?.id).toBe("air");
    expect(matchingInventoryItem([item], "Geladeira")).toBeUndefined();
  });
  it("reconhece o nome sincronizado sem perder a distinção de itens", () => {
    expect(amenityDisplayKey("Quarto 02 · Ar-condicionado")).toBe(amenityDisplayKey("Ar-condicionado"));
    expect(amenityDisplayKey("Aquecimento da água")).not.toBe(amenityDisplayKey("Aquecimento"));
  });
});