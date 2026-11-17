import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidCpf } from "../owner-form-validation";

/**
 * Leitura do Guia STAYO → Admin. Reservas entram no relatório de repasse
 * (upsert por central_reservation_id); proprietários só trazem nome/contato
 * básico — a parte contratual é sempre completada aqui no Admin.
 */
const loose = z.object({ data: z.any() }).passthrough();

async function gate(ctx: { supabase: any }) {
  const { data, error } = await ctx.supabase.rpc("has_admin_role", { roles: ["super_admin", "admin", "finance", "operations"] });
  if (error || data !== true) throw new Error("Acesso restrito à equipe autorizada.");
  const token = process.env["STAYO_API_TOKEN"];
  if (!token) throw new Error("Conexão com o Guia STAYO não configurada.");
  const { createCentralHttp } = await import("./http.server");
  return createCentralHttp({ token });
}

async function listAll(http: any, resource: "reservations" | "owners" | "properties", extra: Record<string, string> = {}) {
  const items: any[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const res = await http.get(`/admin/${resource}`, loose, { limit: "100", ...extra, ...(cursor ? { cursor } : {}) });
    if (!res.ok) throw new Error("Não foi possível consultar o Guia STAYO agora.");
    const d = res.data.data;
    items.push(...(d?.items ?? []));
    if (!d?.page?.has_more || !d.page.next_cursor) break;
    cursor = d.page.next_cursor;
  }
  return items;
}

const channelOf = (c: string) => {
  const v = (c || "").toLowerCase();
  return v.includes("airbnb") ? "airbnb" : v.includes("booking") ? "booking" : v.includes("decolar") ? "decolar" : v.includes("diret") ? "direta" : "outro";
};
const cents = (m: any): number | null => (typeof m?.cents === "number" && m.cents >= 0 ? m.cents : null);

export const syncCentralReservations = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ implementationId: z.string().uuid(), month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(i))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const http = await gate(context);
    const { data: proj, error } = await context.supabase.from("implementation_projects")
      .select("id, core_property_id").eq("id", data.implementationId).maybeSingle();
    if (error || !proj) throw new Error("Ficha não encontrada.");
    if (!proj.core_property_id) return { ok: false as const, reason: "not_linked" as const, imported: 0, updated: 0, found: 0 };
    const { data: cond } = await context.supabase.from("implementation_contract_conditions").select("payout_mode").eq("implementation_id", proj.id).limit(1).maybeSingle();
    const auto = (cond as any)?.payout_mode === "platform_auto";

    const all = await listAll(http, "reservations", { property_id: proj.core_property_id });
    const rows = all.filter((r) => r.property_id === proj.core_property_id && !r.is_block && r.status !== "cancelled" && String(r.checkin_date).startsWith(data.month));

    const { data: existing } = await context.supabase.from("payout_reservations").select("central_reservation_id,payout_flow,manual_amounts")
      .in("central_reservation_id", rows.length ? rows.map((r) => r.id) : ["00000000-0000-0000-0000-000000000000"]);
    const known = new Set((existing ?? []).map((e: any) => e.central_reservation_id));

    let imported = 0, updated = 0;
    for (const r of rows) {
      const st = await http.get(`/admin/reservations/${r.id}/statement`, loose);
      const fin = st.ok ? st.data.data?.finance : null;
      const has = fin && fin.status !== "unavailable";
      const base: Record<string, any> = {
        implementation_id: proj.id, central_reservation_id: r.id, channel: channelOf(r.channel),
        reservation_code: r.reservation_code ?? r.external_reservation_id ?? null,
        guest_name: (st.ok && st.data.data?.titular_guest?.name) || r.guest_name || "Hóspede",
        checkin_date: r.checkin_date, checkout_date: r.checkout_date,
      };
      // Only the provider's resolved titular supplies the document. An omitted,
      // restricted or invalid CPF must not erase a previously saved document.
      const titular = st.ok ? st.data.data?.titular_guest : null;
      if (titular?.status === "resolved" && typeof titular.cpf === "string" && isValidCpf(titular.cpf)) {
        base["guest_cpf"] = titular.cpf.replace(/\D/g, "");
      }
      // Valor ausente no Guia nunca vira zero real: grava 0 técnico e marca em missing_amounts.
      const missing: string[] = [];
      // Valores lançados manualmente pela equipe (com histórico na ficha) nunca são sobrescritos pela sincronização.
      const manual: string[] = (existing?.find((e: any) => e.central_reservation_id === r.id) as any)?.manual_amounts ?? [];
      const pick = (key: string, m: any) => { const v = has ? cents(m) : null; if (v === null) missing.push(key); return v ?? 0; };
      const flow = existing?.find((e: any) => e.central_reservation_id === r.id)?.payout_flow ?? (auto && base["channel"] === "airbnb" ? "platform_auto" : "stayo");
      if (flow === "platform_auto") {
        // Only the individual recipient amount is a direct payment; aggregate net and economic share are not receipts.
        const owner = fin?.payout?.owner_payout;
        base["owner_direct_cents"] = pick("owner_direct", owner?.origin !== "estimated" && owner?.reliability === "confirmed" ? owner : null);
      }
      Object.assign(base, {
        gross_cents: pick("gross", fin?.gross), cleaning_cents: pick("cleaning", fin?.cleaning),
        platform_fee_cents: pick("platform_fee", fin?.platform_fee), missing_amounts: missing,
      });
      for (const k of manual) { delete base[`${k}_cents`]; const i = missing.indexOf(k); if (i >= 0) missing.splice(i, 1); }
      if (known.has(r.id)) {
        const { error: e } = await context.supabase.from("payout_reservations").update(base as any).eq("central_reservation_id", r.id);
        if (!e) updated++;
      } else {
        base["payout_flow"] = auto && base["channel"] === "airbnb" ? "platform_auto" : "stayo";
        base["created_by"] = context.userId;
        const { error: e } = await context.supabase.from("payout_reservations").insert(base as any);
        if (!e) imported++;
      }
    }
    // Reservas importadas antes e que deixaram de valer no Guia (canceladas, bloqueio, outra data/imóvel)
    // saem do relatório; as que têm ajuste manual com histórico ficam e são sinalizadas para revisão.
    const [y, m] = data.month.split("-").map(Number);
    const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    const valid = new Set(rows.map((r) => r.id));
    const { data: local } = await context.supabase.from("payout_reservations").select("id,central_reservation_id,manual_amounts")
      .eq("implementation_id", proj.id).not("central_reservation_id", "is", null).gte("checkin_date", `${data.month}-01`).lt("checkin_date", next);
    let removed = 0, kept = 0;
    for (const row of (local ?? []) as any[]) {
      if (valid.has(row.central_reservation_id)) continue;
      if ((row.manual_amounts?.length ?? 0) > 0) { kept++; continue; }
      const { error: e } = await context.supabase.from("payout_reservations").delete().eq("id", row.id);
      if (!e) removed++;
    }
    return { ok: true as const, reason: null, imported, updated, found: rows.length, removed, kept };
  });

/** Importa apenas proprietários dos imóveis já vinculados; nunca sobrescreve dados do Admin. */
export const importCentralOwners = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  setResponseHeader("Cache-Control", "private, no-store");
  const http = await gate(context);
  const { data: projects } = await context.supabase.from("implementation_projects").select("id, owner_id, core_property_id, core_owner_id").not("core_property_id", "is", null);
  if (!projects?.length) return { linkedProperties: 0, created: 0, linked: 0 };
  const owners = await listAll(http, "owners");
  let created = 0, linked = 0;
  for (const p of projects) {
    const o = owners.find((x) => x.id === p.core_owner_id) ?? owners.find((x) => JSON.stringify(x.properties ?? []).includes(p.core_property_id));
    if (!o) continue;
    const { data: local } = await context.supabase.from("owner_records").select("id, phone, email").eq("core_owner_id", o.id).maybeSingle();
    let ownerId = local?.id ?? p.owner_id;
    if (!ownerId) {
      const { data: ins } = await context.supabase.from("owner_records").insert({ name: o.full_name, phone: o.whatsapp || o.phone || null, email: o.email || null, core_owner_id: o.id }).select("id").single();
      if (ins) { ownerId = ins.id; created++; }
    } else if (!local) {
      await context.supabase.from("owner_records").update({ core_owner_id: o.id }).eq("id", ownerId).is("core_owner_id", null);
    }
    if (ownerId && (!p.owner_id || !p.core_owner_id)) {
      await context.supabase.from("implementation_projects").update({ ...(p.owner_id ? {} : { owner_id: ownerId }), ...(p.core_owner_id ? {} : { core_owner_id: o.id }) }).eq("id", p.id);
      linked++;
    }
  }
  return { linkedProperties: projects.length, created, linked };
});
