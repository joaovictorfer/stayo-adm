import { describe, expect, it } from "vitest";
import { isFullName } from "./full-name";

describe("isFullName", () => {
  it("recusa apenas um nome", () => expect(isFullName("Iedla")).toBe(false));
  it("aceita nome e sobrenome", () => expect(isFullName("Iedla Lemos")).toBe(true));
  it("ignora iniciais soltas", () => expect(isFullName("Iedla A.")).toBe(false));
});
