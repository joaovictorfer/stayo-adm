import { describe, expect, it } from "vitest";
import {
  ALL_CHANNELS,
  filterAllowedChannels,
  isChannelAllowed,
  orderChannels,
  type DistributionChannel,
} from "./owner-platforms";

describe("restrição de plataformas definida pela STAYO", () => {
  it("libera tudo quando não há política definida", () => {
    expect(isChannelAllowed("booking", null)).toBe(true);
    expect(filterAllowedChannels(["airbnb", "booking"], null)).toEqual(["airbnb", "booking"]);
  });

  it("mantém Airbnb mesmo quando a lista liberada não o traz", () => {
    expect(isChannelAllowed("airbnb", ["booking"])).toBe(true);
    expect(filterAllowedChannels(["airbnb", "booking"], ["booking"])).toEqual(["airbnb", "booking"]);
    expect(filterAllowedChannels(["airbnb", "decolar"], ["booking"])).toEqual(["airbnb"]);
  });

  it("remove canal que a STAYO não liberou", () => {
    expect(isChannelAllowed("booking", ["airbnb"])).toBe(false);
    expect(filterAllowedChannels(["airbnb", "booking", "decolar"], ["airbnb", "decolar"])).toEqual(["airbnb", "decolar"]);
  });

  it("não deixa o proprietário reativar um canal bloqueado", () => {
    const blocked = filterAllowedChannels(["airbnb", "booking", "decolar", "direct"], ["airbnb"]);
    expect(blocked).toEqual(["airbnb"]);
    expect(blocked).not.toContain("booking");
  });

  it("preserva a ordem canônica dos canais", () => {
    const shuffled: DistributionChannel[] = ["direct", "airbnb", "booking"];
    expect(orderChannels(shuffled)).toEqual(["airbnb", "booking", "direct"]);
    expect(orderChannels(shuffled)).not.toEqual(shuffled);
  });

  it("a lista canônica traz exatamente as quatro plataformas da operação", () => {
    expect(ALL_CHANNELS).toEqual(["airbnb", "booking", "decolar", "direct"]);
  });
});
