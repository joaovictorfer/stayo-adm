import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { customSecretNames } from "./complements";

// Names only: never read, serialize, log or return environment values.
export const readMigrationComplements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { data: allowed, error } = await context.supabase.rpc("has_admin_role", { roles: ["super_admin", "admin"] });
    if (error || allowed !== true) throw new Error("Acesso restrito à administração.");
    try {
      const names = customSecretNames(Object.keys(process.env));
      return { secretNames: names, secrets_count: names.length };
    } catch {
      throw new Error("Não foi possível carregar os nomes dos complementos. Tente novamente.");
    }
  });