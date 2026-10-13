import { describe, expect, it } from "vitest";
import { setInstall, installValue, type RoomState } from "./amenities";

const room = (id: string, kind: RoomState["kind"] = "quarto"): RoomState => ({ id, name: id, kind, items: {}, custom: [] });

describe("equipamentos por ambiente", () => {
  it.each(["ar", "aquecimento", "moveis"] as const)("preserva marca e instalador de %s separadamente", (key) => {
    let rs = setInstall([room("a"), room("b")], "a", key, "brand", "Marca A");
    rs = setInstall(rs, "a", key, "installer", "Equipe B");
    expect(rs.map((r) => installValue(r, key, "brand"))).toEqual(["Marca A", "Marca A"]);
    expect(rs.map((r) => installValue(r, key, "installer"))).toEqual(["Equipe B", "Equipe B"]);
  });
  it("o que é marcado em um ambiente replica para todos", () => {
    const out = setInstall([room("a"), room("b"), room("s", "sala")], "a", "ar", "brand", "LG");
    expect(out.map((r) => installValue(r, "ar", "brand"))).toEqual(["LG", "LG", "LG"]);
  });
  it("ajuste manual em um ambiente não é sobrescrito pela replicação", () => {
    let rs = setInstall([room("a"), room("b")], "a", "ar", "brand", "LG");
    rs = setInstall(rs, "b", "ar", "brand", "Samsung");
    rs = setInstall(rs, "a", "ar", "brand", "Daikin");
    expect(installValue(rs[1]!, "ar", "brand")).toBe("Samsung");
    expect(installValue(rs[0]!, "ar", "brand")).toBe("Daikin");
  });
  it("instalador de móveis mantém o fornecedor de móveis do ambiente", () => {
    const rs = setInstall([room("a"), room("b")], "a", "moveis", "installer", "Marcenaria X");
    expect(rs[1]!.furnitureSupplier).toBe("Marcenaria X");
  });
});
