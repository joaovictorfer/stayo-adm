import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Fotos de referência do catálogo para o inventário do proprietário.
 * O vínculo é validado no banco como o próprio proprietário (token da sessão);
 * só depois as URLs assinadas (1h) são geradas. Bucket nunca é exposto.
 */
export const getOwnerInventoryImages = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ implementationId: z.string().uuid(), accessToken: z.string().min(20).max(4000) }).parse(d))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const { createClient } = await import("@supabase/supabase-js");
    const userClient = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });
    const { data: paths, error } = await userClient.rpc("owner_inventory_image_paths", { p_implementation_id: data.implementationId });
    if (error || !paths) return {};
    const entries = Object.entries(paths as Record<string, string>);
    if (!entries.length) return {};
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage.from("guide-images").createSignedUrls(entries.map(([, p]) => p), 3600);
    const out: Record<string, string> = {};
    entries.forEach(([id], i) => {
      const url = signed?.[i]?.signedUrl;
      if (url) out[id] = url;
    });
    return out;
  });
