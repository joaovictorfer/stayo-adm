import { describe, expect, it } from "vitest";
import { consolidateFunctions, customSecretNames, exportableFunctions } from "./complements";

describe("migration complements", () => {
  it("excludes source credentials, system variables and platform-managed secrets", () => {
    expect(customSecretNames(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "DATABASE_URL", "DB_ADMIN_KEY", "POSTGRES_PASSWORD", "ADMIN_SECRET", "PATH", "HOME", "DENO_DIR", "DENO_REGION", "XDG_CONFIG_HOME", "LOVABLE_API_KEY", "STAYO_API_TOKEN", "PAGARME_SECRET_KEY", "STAYO_WEBHOOK_SECRET"]))
      .toEqual(["PAGARME_SECRET_KEY", "STAYO_API_TOKEN", "STAYO_WEBHOOK_SECRET"]);
  });
  it("excludes all three temporary functions and preserves original source", () => {
    const code = "import { helper } from './helper.ts';\nexport const original = true;\n";
    const files = { "/supabase/functions/production/index.ts": code, "/supabase/functions/painel-migracao/index.ts": "temporary", "/supabase/functions/migrate-sql/index.ts": "temporary", "/supabase/functions/admin-credentials/index.ts": "temporary" };
    expect(exportableFunctions(files)).toEqual([{ name: "production", code, localImports: ["./helper.ts"] }]);
    expect(consolidateFunctions(files)).toBe(`// ═══ production ═══\n${code}`);
  });
  it("does not invent functions for an empty repository", () => {
    expect(exportableFunctions({})).toEqual([]);
    expect(consolidateFunctions({})).toBe("");
  });
  it("ignores unrelated runtime names and aliases outside the verified inventory", () => {
    expect(customSecretNames(["CPATH", "DEV_SERVER__PROJECT_PATH", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "FONTCONFIG_PATH", "INVOCATION_ID", "UNKNOWN_SECRET", "STAYO_API_TOKEN"])).toEqual(["STAYO_API_TOKEN"]);
  });
});