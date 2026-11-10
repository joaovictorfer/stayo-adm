import { afterEach, describe, expect, it, vi } from "vitest";
import { formatPostalCode, lookupPostalCode, postalAddressPatch } from "./postal-code";

afterEach(() => vi.unstubAllGlobals());

describe("postal code lookup", () => {
  it("formats 92518592 in the Brazilian format", () => {
    expect(formatPostalCode("92518592")).toBe("92518-592");
  });
  it("fills street, district, city and state from the CEP response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ logradouro: "Giuseppe Garibaldi", bairro: "Centro", localidade: "Montenegro", uf: "RS" })));
    vi.stubGlobal("fetch", fetcher);
    expect(await lookupPostalCode("92518-592")).toEqual({ street: "Giuseppe Garibaldi", district: "Centro", city: "Montenegro", state: "RS" });
    expect(fetcher).toHaveBeenCalledWith("https://viacep.com.br/ws/92518592/json/", { signal: undefined, credentials: "omit" });
  });
  it("does not request incomplete postal codes", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(lookupPostalCode("92518")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects nonexistent postal codes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ erro: true }))));
    await expect(lookupPostalCode("00000000")).rejects.toThrow("CEP não encontrado");
  });
  it("preserves number, complement and address fields missing from the provider", () => {
    const previous = { street: "Giuseppe Garibaldi", district: "Petrópolis", city: "Porto Alegre", state: "RS", number: "91", complement: "401" };
    expect({ ...previous, ...postalAddressPatch({ street: "", district: "", city: "Montenegro", state: "RS" }) }).toEqual({ ...previous, city: "Montenegro" });
  });
  it("surfaces provider failures without applying an address", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(lookupPostalCode("92518592")).rejects.toThrow("Busca indisponível");
  });
});