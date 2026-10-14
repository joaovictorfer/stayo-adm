import { describe, expect, it } from "vitest";
import { parseBRLInput } from "../../lib/money-input";

describe("parseBRLInput", () => {
  it("digitar 250 vira R$ 250,00", () => expect(parseBRLInput("250")).toBe(250));
  it("vírgula marca centavos", () => expect(parseBRLInput("250,5")).toBe(250.5));
  it("aceita milhar com ponto", () => expect(parseBRLInput("1.500,00")).toBe(1500));
  it("vazio é zero", () => expect(parseBRLInput("")).toBe(0));
});
