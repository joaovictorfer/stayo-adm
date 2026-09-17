import { describe, expect, it } from "vitest";

import { collectLocalAdminSnapshot } from "./local-to-supabase";

describe("collectLocalAdminSnapshot", () => {
  it("nunca lança fora do browser — retorna listas vazias sem `window`", () => {
    const snapshot = collectLocalAdminSnapshot();

    expect(snapshot).toEqual({
      ownerRecords: [],
      commercialTermDefaults: [],
      commercialTerms: [],
      outboundMessages: [],
      initialCharges: [],
      ownerOnboardingLinks: [],
      ownerOnboardingSubmissions: [],
    });
  });
});
