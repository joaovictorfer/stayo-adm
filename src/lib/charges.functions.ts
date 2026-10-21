import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chargeDraftSchema, chargeActionSchema } from "./charge-contract";
import { hashToken } from "./api/token-hash";
import type { StayoCharge } from "@/types/core";

export const listCharges = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  setResponseHeader("Cache-Control", "no-store");
  const { data, error } = await context.supabase.rpc("admin_list_stayo_charges");
  if (error) throw new Error("Acesso financeiro restrito ou consulta indisponível.");
  return data as unknown as StayoCharge[];
});
export const chargeOptions = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  setResponseHeader("Cache-Control", "no-store");
  const { data: allowed } = await context.supabase.rpc("has_admin_role", { roles: ["super_admin", "admin", "finance"] });
  if (allowed !== true) throw new Error("Acesso financeiro restrito.");
  const [owners, properties] = await Promise.all([
    context.supabase.from("owner_records").select("id,name,email").order("name"),
    context.supabase.from("implementation_projects").select("id,code,nickname,condominium_name,unit").order("code"),
  ]);
  if (owners.error || properties.error) throw new Error("Não foi possível consultar os cadastros.");
  return { owners: owners.data, properties: properties.data.map(p => ({ id: p.id, name: [p.nickname || p.condominium_name || p.code, p.unit].filter(Boolean).join(" · ") })) };
});
export const saveCharge = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => chargeDraftSchema.parse(input)).handler(async ({ data, context }) => {
  setResponseHeader("Cache-Control", "no-store");
  const { data: row, error } = await context.supabase.rpc("admin_save_stayo_charge", { p_data: data });
  if (error) throw new Error(error.message);
  return row as unknown as StayoCharge;
});
export const actionCharge = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => chargeActionSchema.parse(input)).handler(async ({ data, context }) => {
  setResponseHeader("Cache-Control", "no-store");
  const token = data.action === "publish" || data.action === "renew" ? Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("") : null;
  const { data: row, error } = await context.supabase.rpc("admin_action_stayo_charge", { p_id: data.id, p_revision: data.revision, p_action: data.action, ...(data.implementationId ? { p_implementation_id: data.implementationId } : {}), ...(token ? { p_hash: await hashToken(token) } : {}) });
  if (error) throw new Error(error.message);
  return { charge: row as unknown as StayoCharge, token };
});
export const readPublicCharge = createServerFn({ method: "POST" }).inputValidator(input => z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(input)).handler(async ({ data }) => {
  setResponseHeader("Cache-Control", "no-store");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Consulta indisponível.");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key); return fetch(input, { ...init, headers });
  } } });
  const { data: row, error } = await client.rpc("public_stayo_charge", { p_hash: await hashToken(data.token) });
  if (error) throw new Error("Consulta indisponível.");
  return row as unknown as StayoCharge | null;
});