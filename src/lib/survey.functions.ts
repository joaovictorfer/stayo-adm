import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Fotos da vistoria de implantação (link sem login).
 * O token é validado no banco antes de qualquer acesso ao bucket privado.
 */
async function ctx(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("survey_link_ctx", { p_token: token });
  if (error || !data) throw new Error("Link inválido ou expirado");
  return { admin: supabaseAdmin, implementationId: data as string };
}

const tokenSchema = z.string().min(20).max(200);

export const getSurveyMedia = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const { admin, implementationId } = await ctx(data.token);
    const { data: photos } = await admin
      .from("implementation_survey_photos")
      .select("id, guide_item_id, storage_path")
      .eq("implementation_id", implementationId)
      .order("created_at");
    const list = photos ?? [];
    const signed = list.length
      ? (await admin.storage.from("implementation-survey").createSignedUrls(list.map((p) => p.storage_path), 3600)).data
      : [];
    const { data: catalog } = await admin
      .from("guide_catalog_items")
      .select("name, guide_type, image_path, tip")
      .eq("active", true)
      .in("guide_type", ["utensilios", "inventario"]);
    const refs = (catalog ?? []).filter((c) => c.image_path);
    const refSigned = refs.length
      ? (await admin.storage.from("guide-images").createSignedUrls(refs.map((r) => r.image_path!), 3600)).data
      : [];
    const references: Record<string, string> = {};
    // PDF (utensílios) tem prioridade sobre referências genéricas.
    refs
      .map((r, i) => ({ r, url: refSigned?.[i]?.signedUrl }))
      .sort((a, b) => Number(a.r.guide_type === "utensilios") - Number(b.r.guide_type === "utensilios"))
      .forEach(({ r, url }) => { if (url) references[r.name] = url; });
    return {
      photos: list.map((p, i) => ({ id: p.id, itemId: p.guide_item_id, url: signed?.[i]?.signedUrl ?? "" })),
      references,
    };
  });

export const uploadSurveyPhoto = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: tokenSchema, itemId: z.string().uuid(), base64: z.string().min(100).max(9_000_000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { admin, implementationId } = await ctx(data.token);
    const { data: item } = await admin
      .from("implementation_guide_items")
      .select("id")
      .eq("id", data.itemId)
      .eq("implementation_id", implementationId)
      .maybeSingle();
    if (!item) throw new Error("Item não encontrado");
    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const path = `${implementationId}/${data.itemId}/${crypto.randomUUID()}.jpg`;
    const { error } = await admin.storage.from("implementation-survey").upload(path, bin, { contentType: "image/jpeg" });
    if (error) throw new Error("Não foi possível enviar a foto");
    const { data: row, error: insErr } = await admin
      .from("implementation_survey_photos")
      .insert({ implementation_id: implementationId, guide_item_id: data.itemId, storage_path: path })
      .select("id")
      .single();
    if (insErr) throw new Error("Não foi possível registrar a foto");
    const { data: s } = await admin.storage.from("implementation-survey").createSignedUrl(path, 3600);
    return { id: row.id, itemId: data.itemId, url: s?.signedUrl ?? "" };
  });

export const deleteSurveyPhoto = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, photoId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { admin, implementationId } = await ctx(data.token);
    const { data: row } = await admin
      .from("implementation_survey_photos")
      .select("storage_path")
      .eq("id", data.photoId)
      .eq("implementation_id", implementationId)
      .maybeSingle();
    if (!row) return { ok: true };
    await admin.storage.from("implementation-survey").remove([row.storage_path]);
    await admin.from("implementation_survey_photos").delete().eq("id", data.photoId);
    return { ok: true };
  });
