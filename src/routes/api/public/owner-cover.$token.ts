import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BUCKET = "implementation-covers";
const FALLBACK_PATH = "/owner-portal-share.jpg";
const tokenSchema = z.string().min(16).max(256);

const fallbackResponse = (request: Request) =>
  Response.redirect(new URL(FALLBACK_PATH, request.url), 302);

export const Route = createFileRoute("/api/public/owner-cover/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const token = tokenSchema.safeParse(params.token);
        if (!token.success) return fallbackResponse(request);

        const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
        const key =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ??
          process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return fallbackResponse(request);

        const client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: cover, error } = await client.rpc("owner_cover_by_token", {
          p_token: token.data,
        });
        if (error || !cover) return fallbackResponse(request);

        const parsed = cover as { path?: string; source?: string };
        if (
          !parsed.path ||
          (parsed.source !== "implementation" && parsed.source !== "condominium")
        ) {
          return fallbackResponse(request);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: signed, error: signedError } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(parsed.path, 300, {
            transform: { width: 1200, height: 630, resize: "cover", quality: 85 },
          });

        if (signedError || !signed?.signedUrl) return fallbackResponse(request);
        return Response.redirect(signed.signedUrl, 302);
      },
    },
  },
});