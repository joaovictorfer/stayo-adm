import { describe, it, expect, vi } from "vitest";
import { createCentralConsumer } from "./consumer.server";
import { authorizeCentralReservation, restrictedTitular } from "./access";
import { presentStatement, statementSchema, financialFields } from "./statement";
import { adminReservationSchema, adminCheckinSchema } from "./provider-contracts";
import { previewMapping } from "./mapping";
import { accessFixture, checkinFixture, statementFixture, reservationFixture, rid, pid, meta } from "./fixtures.test-support";

function setup() {
  let access = accessFixture(); let statement = statementFixture(); let checkin = checkinFixture();
  const logger = vi.fn();
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const data = url.endsWith("/statement") ? statement : url.endsWith("/checkin") ? checkin : reservationFixture();
    return new Response(JSON.stringify({ data, meta }));
  });
  const consumer = createCentralConsumer({ token: "isolated-synthetic-token", isolatedFixture: true, fetcher: fetcher as typeof fetch, log: logger, loadAccess: async () => structuredClone(access), wait: async () => {}, timeoutMs: 20 });
  return { consumer, fetcher, logger, changeAccess: (a: typeof access) => { access = a; }, changeStatement: (s: typeof statement) => { statement = s; }, changeCheckin: (c: typeof checkin) => { checkin = c; } };
}
describe("Phase 2A isolated consumer", () => {
  it("disabled without secret never calls private network or local reads", async () => {
    const fetcher = vi.fn(); const loadAccess = vi.fn();
    const c = createCentralConsumer({ fetcher, loadAccess });
    expect(await c.statement(rid)).toMatchObject({ ok: false, kind: "not_configured" }); expect(fetcher).not.toHaveBeenCalled(); expect(loadAccess).not.toHaveBeenCalled();
  });
  it("even configured production remains disabled", async () => {
    const fetcher = vi.fn(); const loadAccess = vi.fn();
    const c = createCentralConsumer({ token: "isolated-synthetic-token", fetcher, loadAccess });
    expect(await c.titular(rid, ["admin:read", "admin:sensitive"])).toMatchObject({ ok: false, kind: "connection_disabled" }); expect(fetcher).not.toHaveBeenCalled();
  });
  it("UUID matching never merges by name and preserves local data", () => {
    const local = [{ id: "a", coreId: pid, name: "Same", notes: "preserve" }, { id: "b", coreId: null, name: "Same", notes: "other" }];
    const before = structuredClone(local); expect(previewMapping(local.map(r => ({ localId:r.id, externalId:r.coreId, code:r.name, updatedAt:null })), [{ id:pid }], null).map(r => r.state)).toEqual(["matched_uuid", "local_unlinked"]); expect(local).toEqual(before);
  });
  it("requires actual reservation-to-property UUID even on direct ID access", async () => {
    const s = setup(); expect((await s.consumer.statement(rid)).ok).toBe(true);
    const a = accessFixture(); a.projects[0] = { id: "other", owner_id: "local-owner", core_owner_id: a.owners[0]?.core_owner_id ?? null, core_property_id: "44444444-4444-4444-8444-444444444444", status: "ativo" }; s.changeAccess(a);
    expect(await s.consumer.statement(rid)).toMatchObject({ ok: false, kind: "unlinked" });
  });
  it("rejects mismatched direct reservation IDs", async () => {
    expect(await setup().consumer.statement("44444444-4444-4444-8444-444444444444")).toMatchObject({ ok: false, kind: "invalid_response" });
  });
  it("denies owner portal A even with owner B ID and admin provider scopes", async () => {
    const s = setup(); const a = accessFixture(); a.userId = "owner-A"; a.adminAllowed = false; s.changeAccess(a);
    expect(await s.consumer.titular(rid, ["admin:read", "admin:sensitive"])).toMatchObject({ ok: false, kind: "forbidden" }); expect(s.fetcher).not.toHaveBeenCalled();
  });
  it("denies duplicate and revoked links", () => {
    const a = accessFixture(); const p = a.projects[0]; if (!p) throw Error("fixture"); a.projects.push({ ...p, id: "duplicate" });
    expect(authorizeCentralReservation(a, reservationFixture())).toEqual({ ok: false, kind: "ambiguous_link" });
    a.projects = [{ ...p, status: "implantacao" }]; expect(authorizeCentralReservation(a, reservationFixture())).toEqual({ ok: false, kind: "unlinked" });
  });
  it("rejects owner-reference divergence", () => {
    const a = accessFixture(); a.owners = [{ id: "local-owner", core_owner_id: "wrong-owner" }];
    expect(authorizeCentralReservation(a, reservationFixture())).toEqual({ ok: false, kind: "ambiguous_link" });
  });
  it("reservation without receivable retains null versus zero", () => {
    const s = statementFixture(); s.finance.status = "unavailable";
    for (const k of financialFields) s.finance[k] = { cents: null, currency: "BRL", origin: "missing", reliability: "unavailable" };
    expect(presentStatement(statementSchema.parse(s)).rows.every(r => r.cents === null)).toBe(true);
    expect(presentStatement(statementFixture()).rows.find(r => r.key === "platform_fee")?.cents).toBe(0);
    s.finance.cleaning.cents = 0; expect(statementSchema.safeParse(s).success).toBe(false);
  });
  it("preserves cents, origin, source, reliability and never recalculates shares", () => {
    const s = statementFixture(); s.finance.owner_economic_value.origin = "manual";
    const report = presentStatement(statementSchema.parse(s));
    expect(report.rows.find(r => r.key === "owner_economic_value")).toMatchObject({ cents: 80684, origin: "manual", source: "synthetic_fixture", reliability: "confirmed" });
    expect(report.rows.find(r => r.key === "stayo_total")?.cents).toBe(19317); expect(report.payoutConfirmed).toBe(false);
  });
  it("requires cumulative scopes and local sensitive purpose", () => {
    for (const scopes of [[], ["admin:read"], ["admin:sensitive"]]) expect(restrictedTitular(checkinFixture(), true, scopes).document === null).toBe(true);
    expect(restrictedTitular(checkinFixture(), false, ["admin:read", "admin:sensitive"]).document === null).toBe(true);
    expect(restrictedTitular(checkinFixture(), true, ["admin:read", "admin:sensitive"]).status).toBe("valid_cpf");
  });
  it.each(["missing", "ambiguous"] as const)("handles %s titular explicitly", status => {
    const c = checkinFixture(); c.titular.titular_status = status;
    expect(restrictedTitular(c, true, ["admin:read", "admin:sensitive"])).toEqual({ status, document: null });
  });
  it.each(["invalid_cpf", "non_cpf_document", "missing"] as const)("handles %s document explicitly", status => {
    const c = checkinFixture(); c.titular.document_status = status;
    expect(restrictedTitular(c, true, ["admin:read", "admin:sensitive"])).toEqual({ status, document: null });
  });
  it("rejects invalid CPF despite provider valid flag", () => {
    const c = checkinFixture(); c.titular.document = "00000000000";
    expect(restrictedTitular(c, true, ["admin:read", "admin:sensitive"]).status).toBe("invalid_cpf");
  });
  it("revalidates local authorization after document fetch", async () => {
    let n = 0; const a = accessFixture();
    const c = createCentralConsumer({ token: "synthetic", isolatedFixture: true, loadAccess: async () => ({ ...a, sensitiveAllowed: ++n === 1 }), fetcher: (async (url: string) => new Response(JSON.stringify({ data: url.endsWith("/checkin") ? checkinFixture() : reservationFixture(), meta }))) as typeof fetch });
    expect(await c.titular(rid, ["admin:read", "admin:sensitive"])).toMatchObject({ ok: false, kind: "forbidden" });
  });
  it("document update without reservation update is reread with no cache", async () => {
    const s = setup(); const scopes = ["admin:read", "admin:sensitive"];
    const first = await s.consumer.titular(rid, scopes); expect(first.ok && "status" in first.data && first.data.status).toBe("valid_cpf");
    const c = checkinFixture(); c.titular.document_status = "missing"; c.titular.document = null; s.changeCheckin(c);
    const next = await s.consumer.titular(rid, scopes); expect(next.ok && "status" in next.data && next.data.status).toBe("missing"); expect(s.fetcher).toHaveBeenCalledTimes(4);
  });
  it("rereads financial correction for old reservation independently of reservation timestamp", async () => {
    const s = setup(); await s.consumer.statement(rid); const updated = statementFixture(); updated.finance.owner_economic_value.cents = 90001; s.changeStatement(updated);
    const r = await s.consumer.statement(rid); expect(r.ok && "finance" in r.data.data && r.data.data.finance.owner_economic_value.cents).toBe(90001);
  });
  it("synthetic fixtures parse actual OpenAPI projections", () => {
    expect(adminReservationSchema.safeParse(reservationFixture()).success).toBe(true); expect(adminCheckinSchema.safeParse(checkinFixture()).success).toBe(true);
  });
  it("multiple primary guests never expose a document", () => {
    const c = checkinFixture(); const guest = c.guests[0]; if (!guest) throw Error("fixture"); c.guests.push({ ...guest, id:"other-primary" });
    expect(restrictedTitular(c,true,["admin:read","admin:sensitive"])).toEqual({ status:"ambiguous",document:null });
  });
  it("revalidates finance authorization after fetching statement", async () => {
    let reads = 0; const a = accessFixture();
    const c=createCentralConsumer({ token:"synthetic",isolatedFixture:true,loadAccess:async()=>({...a,adminAllowed:++reads===1}),fetcher:(async(url:string)=>new Response(JSON.stringify({data:url.endsWith("/statement")?statementFixture():reservationFixture(),meta}))) as typeof fetch });
    expect(await c.statement(rid)).toMatchObject({ok:false,kind:"forbidden"});
  });
  it("list resource filters do not become implicit authorization", async () => {
    const s=setup(); expect(await s.consumer.list("owners",{property_id:pid})).toMatchObject({ok:false,kind:"invalid_response"});expect(s.fetcher).not.toHaveBeenCalled();
  });
  it("logs never contain provider payload, credentials or documents", async () => {
    const s = setup(); await s.consumer.titular(rid, ["admin:read", "admin:sensitive"]);
    const logs = JSON.stringify(s.logger.mock.calls); expect(logs.includes("isolated-synthetic-token")).toBe(false); expect(logs.includes(checkinFixture().titular.document ?? "fixture-impossible")).toBe(false); expect(logs.includes("Titular sintético")).toBe(false);
  });
});