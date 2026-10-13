import { describe, expect, it } from "vitest";
import { ROOM_SECTIONS, type AmenitiesData, type RoomState } from "./amenities";
import { buildSyncRows } from "./amenities-sync";

const data = (items: RoomState["items"]): AmenitiesData => ({
  rooms: [{ id: "r1", kind: "cozinha", name: "Cozinha", items, custom: [] }],
});

describe("comodidades em grupo → inventário", () => {
  const group = ROOM_SECTIONS.cozinha[0].items[0];

  it("reúne os eletrodomésticos declarados pelo Victor num único grupo", () => {
    expect(group.key).toBe("eletrodomesticos");
    expect(group.label).toBe("Eletrodomésticos");
    expect(group.subAnswers).toBe(true);
    expect((group.sub ?? []).map((s) => s.label)).toEqual([
      "Micro-ondas",
      "Forno convencional",
      "Airfryer",
      "Torradeira",
      "Cafeteira de cápsulas",
      "Cafeteira elétrica",
      "Chaleira elétrica",
      "Geladeira",
      "Frigobar",
      "Adega",
      "Purificador de água",
    ]);
  });

  it("mantém a resposta do subitem quando o grupo ainda não foi respondido", () => {
    const row = buildSyncRows(data({ micro_ondas: { on: true } })).find((r) => r.amenity_key === "r:r1:micro_ondas");
    expect(row?.on).toBe(true);
    expect(row?.name).toBe("Cozinha · Micro-ondas");
  });

  it("usa a chave própria do subitem, sem abrir um espelho novo por baixo do grupo", () => {
    const keys = buildSyncRows(data({ geladeira: { on: true }, forno_convencional: { on: false } })).map((r) => r.amenity_key);
    expect(keys).toContain("r:r1:geladeira");
    expect(keys).toContain("r:r1:forno_convencional");
    expect(keys.some((k) => k.endsWith(":eletrodomesticos.geladeira"))).toBe(false);
  });

  it("desliga os subitens quando o grupo é marcado como Não", () => {
    const row = buildSyncRows(data({ eletrodomesticos: { on: false }, geladeira: { on: true } })).find(
      (r) => r.amenity_key === "r:r1:geladeira",
    );
    expect(row?.on).toBe(false);
  });
});
