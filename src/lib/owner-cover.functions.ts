import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export type OwnerCover = {
  url: string;
  source: "implementation" | "condominium";
  label: string | null;
} | null;

const BUCKET = "implementation-covers";

/**
 * Devolve uma URL assinada (1h) da capa efetiva do link do proprietário.
 * A autorização é feita no banco: por token válido (apresentação, cadastro ou
 * implantação) ou pela sessão do proprietário/equipe. O bucket continua privado.
 */
export const getOwnerCover = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .union([
        z.object({ token: z.string().min(16).max(256) }),
        z.object({
          implementationId: z.string().uuid(),
          accessToken: z.string().min(20).max(4096),
        }),
      ])
      .parse(data),
  )
  .handler(async ({ data }): Promise<OwnerCover> => {
    const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
    const key =
      process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return null;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global:
        "accessToken" in data ? { headers: { Authorization: `Bearer ${data.accessToken}` } } : {},
    });
    const { data: cover, error } =
      "token" in data
        ? await client.rpc("owner_cover_by_token", { p_token: data.token })
        : await client.rpc("owner_cover_for_implementation", {
            p_implementation_id: data.implementationId,
          });
    if (error || !cover) return null;
    const parsed = cover as { path?: string; source?: string; label?: string | null };
    if (!parsed.path || (parsed.source !== "implementation" && parsed.source !== "condominium"))
      return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(parsed.path, 3600);
    if (!signed?.signedUrl) return null;
    return { url: signed.signedUrl, source: parsed.source, label: parsed.label ?? null };
  });
