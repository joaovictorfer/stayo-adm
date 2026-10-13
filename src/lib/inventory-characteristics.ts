import { amenityDisplayKey } from "./inventory-amenities-view";

export function inventoryCharacteristic(name: string) {
  const key = amenityDisplayKey(name);
  if (key === "sofa" || key === "sofa_cama") return { key: "sofaType", label: "Tipo de sofá", options: ["Sofá-cama", "Convencional"] } as const;
  if (key === "mesa" || key === "mesa_jantar" || key === "mesa_de_jantar") return { key: "seats", label: "Lugares da mesa", options: null } as const;
  if (key === "ar_condicionado") return { key: "climateMode", label: "Modo do ar-condicionado", options: ["Quente/frio", "Só frio"] } as const;
  return null;
}