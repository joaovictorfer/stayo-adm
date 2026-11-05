import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CentralErrorKind } from "./contracts";
import type { AppPropertyCandidate } from "./property-link";

type Failure = { ok: false; kind: CentralErrorKind | "linked_elsewhere" | "needs_ack" | "same_already" | "not_ready" };
const fail = (kind: Failure["kind"]): Failure => ({ ok: false, kind });

/** Mesmo gate dos demais leitores: só administradores; consumidor fica desligado até a homologação. */
async function consumerFor(ctx: { supabase: any; userId: string }) {
  const { data: allowed, error } = await ctx.supabase.rpc("has_admin_role", { roles: ["super_admin", "admin"] });
  if (error || allowed !== true) return { error: fail("forbidden") };
  const token = process.env["STAYO_API_TOKEN"];
  if (!token) return { error: fail("not_configured") };
  const { createCentralConsumer, CENTRAL_PRODUCTION_ENABLED } = await import("./consumer.server");
  if (!CENTRAL_PRODUCTION_ENABLED) return { error: fail("connection_disabled") };
  const { createCentralHttp } = await import("./http.server");
  const consumer = createCentralConsumer({ token, loadAccess: async () => ({ userId: ctx.userId, adminAllowed: true, sensitiveAllowed: false, projects: [], owners: [] }) });
  return { consumer, http: createCentralHttp({ token }) };
}

function toCandidate(p: any, linked: Map<string, string>): AppPropertyCandidate | null {
  if (!p?.id) return null;
  const a = p.address ?? {};
  const address = [a.street, a.number, a.complement].filter(Boolean).join(", ") || null;
  return { id: p.id, name: p.name ?? null, code: p.property_code ?? p.code ?? null, address, city: [p.city, p.state].filter(Boolean).join("/") || null, linkedToCode: linked.get(p.id) ?? null };
}

async function linkedMap(supabase: any, exceptId: string) {
  const { data } = await supabase.from("implementation_projects").select("id,code,core_property_id").not("core_property_id", "is", null);
  return new Map<string, string>((data ?? []).filter((r: any) => r.id !== exceptId).map((r: any) => [r.core_property_id, r.code ?? "outra ficha"]));
}

export const appLinkAvailability = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  setResponseHeader("Cache-Control", "no-store");
  const r = await consumerFor(context);
  return "error" in r ? { enabled: false, kind: r.error!.kind } : { enabled: true, kind: null };
});

export const searchAppProperties = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ implementationId: z.string().uuid(), query: z.string().trim().min(2).max(80) }).parse(i))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const r = await consumerFor(context);
    if ("error" in r) return r.error!;
    const { matchesQuery } = await import("./property-link");
    const linked = await linkedMap(context.supabase, data.implementationId);
    const found: AppPropertyCandidate[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 5; page++) {
      const res: any = await r.consumer!.list("properties", { limit: 100, ...(cursor ? { cursor } : {}) });
      if (!res.ok) return fail(res.kind);
      for (const p of res.data.data.items) { const c = toCandidate(p, linked); if (c && matchesQuery(c, data.query)) found.push(c); }
      if (!res.data.data.page.has_more || found.length >= 20) break;
      cursor = res.data.data.page.next_cursor;
    }
    return { ok: true as const, items: found.slice(0, 20) };
  });

export const linkAppProperty = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ implementationId: z.string().uuid(), corePropertyId: z.string().uuid(), acknowledged: z.boolean() }).parse(i))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const r = await consumerFor(context);
    if ("error" in r) return r.error!;
    const { adminPropertySchema, providerEnvelope } = await import("./provider-contracts");
    // Relê o imóvel na origem: nunca grava um id que o APP não confirmou agora.
    const res: any = await r.http!.get(`/admin/properties/${data.corePropertyId}`, providerEnvelope(adminPropertySchema));
    if (!res.ok) return fail(res.kind);
    if (res.data.data.id !== data.corePropertyId) return fail("invalid_response");
    const { data: project, error } = await context.supabase.from("implementation_projects").select("id,core_property_id,condominium_name,unit,address").eq("id", data.implementationId).maybeSingle();
    if (error || !project) return fail("forbidden");
    const linked = await linkedMap(context.supabase, data.implementationId);
    const cand = toCandidate(res.data.data, linked)!;
    const { compareProperty, decideLink } = await import("./property-link");
    const differences = compareProperty({ condominium: project.condominium_name, unit: project.unit, address: project.address }, cand).filter((x) => x.differs).length;
    const decision = decideLink({ currentCoreId: project.core_property_id, candidateId: cand.id, linkedToOtherCode: cand.linkedToCode, differences, acknowledged: data.acknowledged });
    if (!decision.ok) return fail(decision.reason);
    const { error: upErr } = await context.supabase.from("implementation_projects").update({ core_property_id: cand.id }).eq("id", data.implementationId);
    if (upErr) return fail(upErr.code === "23505" ? "linked_elsewhere" : "forbidden");
    await context.supabase.from("audit_logs").insert({ actor_id: context.userId, event: "core.property_linked", entity_type: "implementation", entity_id: data.implementationId, metadata: { differences } });
    return { ok: true as const };
  });
