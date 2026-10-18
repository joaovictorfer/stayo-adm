import { describe, expect, it } from "vitest";
import { suiteCount } from "./amenities";
describe("resumo canônico de suítes", () => {
  it("dois quartos com um privativo mostram uma suíte, não o escalar legado", () => {
    expect(suiteCount({ rooms: [{ kind: "quarto", suite: true }, { kind: "quarto", suite: false }, { kind: "banheiro", suite: true }] }, 4)).toBe(1);
  });
  it("zero suítes informado substitui o valor antigo", () => {
    expect(suiteCount({ rooms: [{ kind: "quarto", suite: false }] }, 2)).toBe(0);
  });
  it("sem composição preserva a informação anterior", () => {
    expect(suiteCount(null, 2)).toBe(2);
    expect(suiteCount(null)).toBeNull();
  });
});