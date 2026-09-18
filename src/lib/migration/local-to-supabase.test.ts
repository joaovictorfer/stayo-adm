import { describe, expect, it } from "vitest";

import {
  collectLocalAdminSnapshot,
  readMigrationStatus,
  writeMigrationStatus,
} from "./local-to-supabase";

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

describe("readMigrationStatus/writeMigrationStatus", () => {
  it("nunca lança fora do browser — read retorna null, write é no-op", () => {
    expect(readMigrationStatus()).toBeNull();
    expect(() =>
      writeMigrationStatus({ lastImportedAt: "2024-01-01", lastValidatedAt: null, allValid: true }),
    ).not.toThrow();
  });
});
