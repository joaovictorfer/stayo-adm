import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Recorrência (15 min): puxa as próximas reservas do Guia para todos os imóveis em operação vinculados. */
export const Route = createFileRoute("/api/public/jobs/sync-reservations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const token = process.env["STAYO_API_TOKEN"];
        if (!token) return Response.json({ ok: false }, { status: 503 });
        const { createCentralHttp } = await import("@/lib/stayo-central/http.server");
        const { runUpcomingSync } = await import("@/lib/stayo-central/sync.functions");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
        const r = await runUpcomingSync({ supabase: supabaseAdmin }, createCentralHttp({ token }), today, 3);
        return Response.json({ ok: true, ...r });
      },
    },
  },
});
