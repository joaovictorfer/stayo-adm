import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const builder = { middleware: () => builder, handler: (handler: unknown) => handler }; return builder; } }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { readMigrationComplements } from "./complements.functions";
const invoke = readMigrationComplements as unknown as (input: unknown) => Promise<{ secretNames: string[]; secrets_count: number }>;
describe("migration authorization", () => {
  it.each([false, null, undefined])("fails closed for unauthorized or missing role: %s", async (allowed) => {
    await expect(invoke({ context: { supabase: { rpc: async () => ({ data: allowed, error: null }) } } })).rejects.toThrow("Acesso restrito");
  });
  it("returns only names and a count for an authorized administrator", async () => {
    const result = await invoke({ context: { supabase: { rpc: async () => ({ data: true, error: null }) } } });
    expect(Object.keys(result).sort()).toEqual(["secretNames", "secrets_count"]);
    expect(result.secrets_count).toBe(result.secretNames.length);
    expect(result.secretNames.some((name) => name.startsWith("SUPABASE_") || name.includes("SERVICE_ROLE"))).toBe(false);
  });
});