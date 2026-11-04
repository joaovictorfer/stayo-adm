import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CENTRAL_BASE_URL, messages } from "./contracts";

const requestSchema = z.object({ reservationId: z.string().uuid() }).strict();

/** Preparation only: no secret can enable these handlers in Phase 2A. */
export const readCentralStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator(input => requestSchema.parse(input))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const role = await context.supabase.rpc("has_admin_role", { roles: ["super_admin", "admin"] });
    if (role.error || role.data !== true) return { ok: false as const, kind: "forbidden" as const, message: messages.forbidden };
    const { createCentralConsumer } = await import("./consumer.server");
    const consumer = createCentralConsumer({
      token: process.env["STAYO_API_TOKEN"] || "", baseUrl: process.env["STAYO_API_URL"] || CENTRAL_BASE_URL,
      loadAccess: async () => {
        const [projects, owners, freshRole] = await Promise.all([
          context.supabase.from("implementation_projects").select("id,owner_id,core_property_id,core_owner_id,status"),
          context.supabase.from("owner_records").select("id,core_owner_id"),
          context.supabase.rpc("has_admin_role", { roles: ["super_admin", "admin"] }),
        ]);
        if (projects.error || owners.error || freshRole.error) throw new Error("Autorização indisponível.");
        return { userId: context.userId, adminAllowed: freshRole.data === true, sensitiveAllowed: false, projects: projects.data || [], owners: owners.data || [] };
      },
    });
    const result = await consumer.statement(data.reservationId);
    return result.ok ? { ok: true as const, statement: result.data.data } : { ...result, message: messages[result.kind] };
  });

// No general CPF endpoint is exposed. Future authorized purpose must be
// reviewed before wiring createCentralConsumer.titular to an RPC or route.