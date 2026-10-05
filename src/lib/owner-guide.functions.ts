import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * URLs assinadas (1h) das fotos do guia liberado para o token do convite.
 * A checagem de token e liberação acontece no banco (owner_guide_image_paths).
 */
export const getOwnerGuideImages = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string().min(32).max(200), guideType: z.enum(["utensilios", "enxoval"]).default("utensilios") }).parse(data))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: paths, error } = await supabaseAdmin.rpc("owner_guide_image_paths", { p_token: data.token, p_guide_type: data.guideType });
    if (error || !paths) return {};
    const entries = Object.entries(paths as Record<string, string>);
    if (!entries.length) return {};
    const { data: signed } = await supabaseAdmin.storage
      .from("guide-images")
      .createSignedUrls(entries.map(([, p]) => p), 3600);
    const out: Record<string, string> = {};
    entries.forEach(([id], i) => {
      const url = signed?.[i]?.signedUrl;
      if (url) out[id] = url;
    });
    return out;
  });

/** URLs assinadas das fotos do inventário da implantação, pelo token do cadastro (proposta confirmada). */
export const getOwnerInventoryImagesByToken = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string().min(32).max(200) }).parse(data))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: paths, error } = await supabaseAdmin.rpc("owner_inventory_image_paths_by_token", { p_token: data.token });
    if (error || !paths) return {};
    const entries = Object.entries(paths as Record<string, string>);
    if (!entries.length) return {};
    const { data: signed } = await supabaseAdmin.storage.from("guide-images").createSignedUrls(entries.map(([, p]) => p), 3600);
    const out: Record<string, string> = {};
    entries.forEach(([id], i) => {
      const url = signed?.[i]?.signedUrl;
      if (url) out[id] = url;
    });
    return out;
  });
