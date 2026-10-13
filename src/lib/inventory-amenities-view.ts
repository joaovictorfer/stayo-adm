import type { InventorySnapshotItem } from "./guided-inventory";

const aliases: Record<string, string> = {
  airfryer: "air_fryer",
  cama: "camas",
  aquecedor: "aquecimento",
  panelas: "jogo_de_panelas_antiaderentes",
  mesa: "mesa_de_jantar",
  mesa_jantar: "mesa_de_jantar",
  copos: "copos_de_vidro",
  abridor_de_vinho: "abridor_de_vinho_e_garrafa",
  forma_de_bolo: "forma_de_bolo_assadeira_retangular",
  escorredor_de_pia: "escorredor_de_loucas",
  pa_de_lixo: "pa_de_lixo_vassourinha",
  ferro_de_passar: "ferro_de_passar_roupa",
};

export function amenityDisplayKey(name: string): string {
  const plain = name.split(" · ").at(-1) ?? name;
  const key = plain.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return aliases[key] ?? key;
}

/** Presentation-only association; never merges or rewrites stored records. */
export function matchingInventoryItem(items: InventorySnapshotItem[], label: string) {
  const key = amenityDisplayKey(label);
  return items.find((item) => amenityDisplayKey(item.name) === key);
}