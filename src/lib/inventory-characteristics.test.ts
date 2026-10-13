import { describe, expect, it } from "vitest";
import { inventoryCharacteristic } from "./inventory-characteristics";

describe("inventory characteristics", () => {
  it("distinguishes sofa bed and conventional sofa", () => {
    expect(inventoryCharacteristic("Sofá")?.options).toEqual(["Sofá-cama", "Convencional"]);
  });
  it("stores table seating separately from item quantity", () => {
    expect(inventoryCharacteristic("Mesa de jantar")?.key).toBe("seats");
    expect(inventoryCharacteristic("Mesa")?.options).toBeNull();
  });
  it("distinguishes air conditioning modes", () => {
    expect(inventoryCharacteristic("Ar-condicionado")?.options).toEqual(["Quente/frio", "Só frio"]);
  });
});