import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { linenPayloadSchema, validateLinen } from "./linen";
import type { AmenitiesData } from "./amenities";
const selection = z.object({ implementationId: z.string().uuid() });
export const getLinenWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => selection.parse(i))
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { data: allowed } = await context.supabase.rpc("has_admin_role", {
      roles: ["super_admin", "admin", "operations", "commercial"],
    });
    if (allowed !== true) throw new Error("Acesso restrito.");
    const [docs, events, existing, rooms, prices] = await Promise.all([
      context.supabase
        .from("linen_documents")
        .select("*")
        .eq("implementation_id", data.implementationId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("linen_events")
        .select("*")
        .eq("implementation_id", data.implementationId)
        .order("created_at"),
      context.supabase
        .from("linen_existing")
        .select("*")
        .eq("implementation_id", data.implementationId),
      context.supabase
        .from("implementation_amenities")
        .select("data")
        .eq("implementation_id", data.implementationId)
        .maybeSingle(),
      context.supabase
        .from("linen_documents")
        .select("id,kind,payload,confirmed_at")
        .eq("status", "confirmed")
        .order("confirmed_at", { ascending: false }),
    ]);
    for (const q of [docs, events, existing, rooms, prices])
      if (q.error) throw new Error("Não foi possível consultar o enxoval.");
    return {
      documents: docs.data ?? [],
      events: events.data ?? [],
      existing: existing.data ?? [],
      rooms: (rooms.data?.data ?? { rooms: [] }) as unknown as AmenitiesData,
      prices: prices.data ?? [],
    };
  });
export const importLinenDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: FormData) => {
    if (!(i instanceof FormData)) throw new Error("Documento obrigatório.");
    const file = i.get("file");
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > 10 * 1024 * 1024 ||
      !["application/pdf", "image/png", "image/jpeg"].includes(file.type)
    )
      throw new Error("Envie PDF, JPG ou PNG de até 10 MB.");
    return {
      ...selection
        .extend({ kind: z.enum(["quote", "order", "invoice"]) })
        .parse(Object.fromEntries(i)),
      file,
    };
  })
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { data: allowed } = await context.supabase.rpc("has_admin_role", {
      roles: ["super_admin", "admin", "operations", "commercial"],
    });
    if (allowed !== true) throw new Error("Acesso restrito.");
    const bytes = new Uint8Array(await data.file.arrayBuffer());
    const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    const { data: previous } = await context.supabase
      .from("linen_documents")
      .select("id")
      .eq("implementation_id", data.implementationId)
      .eq("kind", data.kind)
      .eq("fingerprint", fingerprint)
      .maybeSingle();
    if (previous) return previous;
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Leitura automática indisponível.");
    const { analyzeLinen } = await import("./linen/analysis.server");
    const payload = await analyzeLinen(data.file, key);
    const path = `${data.implementationId}/${fingerprint}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upload } = await supabaseAdmin.storage
      .from("linen-documents")
      .upload(path, bytes, { contentType: data.file.type, upsert: true });
    if (upload) throw new Error("Não foi possível guardar o documento.");
    const { data: result, error } = await context.supabase.rpc("admin_linen_apply", {
      p_data: {
        action: "create",
        implementationId: data.implementationId,
        kind: data.kind,
        fingerprint,
        path,
        filename: data.file.name.slice(0, 200),
        payload,
      },
    });
    if (error) throw new Error(error.message);
    return result;
  });
const action = selection.extend({
  action: z.enum(["confirm", "correct", "existing", "receive"]),
  documentId: z.string().uuid().optional(),
  revision: z.number().int().positive().optional(),
  payload: linenPayloadSchema.optional(),
  itemKey: z.string().max(160).optional(),
  quantity: z.number().int().min(0).max(999).optional(),
  index: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
  condition: z.enum(["good", "defect", "mismatch"]).optional(),
  evidencePath: z.string().optional(),
});
export const saveLinenAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => action.parse(i))
  .handler(async ({ data, context }) => {
    if (data.action === "confirm" || data.action === "correct") {
      if (!data.payload || !data.documentId || !data.revision)
        throw new Error("Revisão incompleta.");
      validateLinen(data.payload);
    }
    if (data.action === "existing" && (!data.itemKey || data.quantity === undefined))
      throw new Error("Quantidade obrigatória.");
    if (
      data.action === "receive" &&
      (!data.documentId ||
        !data.revision ||
        data.index === undefined ||
        !data.quantity ||
        !data.condition)
    )
      throw new Error("Conferência incompleta.");
    const { data: result, error } = await context.supabase.rpc("admin_linen_apply", {
      p_data: JSON.parse(JSON.stringify(data)),
    });
    if (error) throw new Error(error.message);
    return result;
  });
export const openLinenDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("linen_documents")
      .select("storage_path")
      .eq("id", data.id)
      .single();
    if (error || !doc) throw new Error("Documento indisponível.");
    const { data: url, error: failure } = await context.supabase.storage
      .from("linen-documents")
      .createSignedUrl(doc.storage_path, 300);
    if (failure) throw new Error("Documento indisponível.");
    return url.signedUrl;
  });

export const uploadLinenEvidence = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: FormData) => {
  if (!(input instanceof FormData)) throw new Error("Foto obrigatória.");
  const file = input.get("file");
  if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(file.type)) throw new Error("Envie foto JPG ou PNG de até 10 MB.");
  return { ...selection.parse(Object.fromEntries(input)), file };
}).handler(async ({ data, context }) => {
  const { data: allowed } = await context.supabase.rpc("has_admin_role", { roles: ["super_admin", "admin", "operations", "commercial"] });
  if (allowed !== true) throw new Error("Acesso restrito.");
  const { data: property } = await context.supabase.from("implementation_projects").select("id").eq("id", data.implementationId).single();
  if (!property) throw new Error("Imóvel indisponível.");
  const path = `${data.implementationId}/evidence/${crypto.randomUUID()}`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage.from("linen-documents").upload(path, data.file, { contentType: data.file.type });
  if (error) throw new Error("Foto não salva.");
  return path;
});
export const openLinenEvidence = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(i => z.object({ id: z.string().uuid() }).parse(i)).handler(async ({ data, context }) => {
  const { data: event } = await context.supabase.from("linen_events").select("payload").eq("id", data.id).single();
  const path = (event?.payload as Record<string, unknown> | undefined)?.["evidencePath"];
  if (typeof path !== "string") throw new Error("Foto indisponível.");
  const { data: url, error } = await context.supabase.storage.from("linen-documents").createSignedUrl(path, 300);
  if (error) throw new Error("Foto indisponível.");
  return url.signedUrl;
});
