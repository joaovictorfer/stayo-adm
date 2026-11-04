import { z } from "zod";
import { createCentralHttp, type HttpOptions } from "./http.server";
import { listEnvelope, type CentralResource, type CentralFilters, type CentralFailure } from "./contracts";
import { adminReservationSchema, adminPropertySchema, adminOwnerSchema, adminCheckinSchema, providerEnvelope } from "./provider-contracts";
import { statementEnvelope } from "./statement";
import { authorizeCentralReservation, restrictedTitular, type LocalAccessSnapshot } from "./access";

// Production use requires a future reviewed change: no environment flag can
// silently turn this preparation phase into authenticated production access.
export const CENTRAL_PRODUCTION_ENABLED = false;
export interface ConsumerOptions extends HttpOptions { isolatedFixture?: boolean; loadAccess: () => Promise<LocalAccessSnapshot> }
export function createCentralConsumer(options: ConsumerOptions) {
  const http = createCentralHttp(options);
  const disabled = (): CentralFailure | null => !options.token ? { ok: false, kind: "not_configured", status: null, requestId: null, retryAfterMs: null } : !options.isolatedFixture ? { ok: false, kind: "connection_disabled", status: null, requestId: null, retryAfterMs: null } : null;
  const failure = (kind: CentralFailure["kind"]): CentralFailure => ({ ok: false, kind, status: null, requestId: null, retryAfterMs: null });
  const schemas = { properties: adminPropertySchema, owners: adminOwnerSchema, reservations: adminReservationSchema };
  async function list(resource: CentralResource, filters: CentralFilters = {}) {
    const off = disabled(); if (off) return off;
    const access = await options.loadAccess(); if (!access.userId || !access.adminAllowed) return failure("forbidden");
    const query = Object.fromEntries(Object.entries(filters).filter(([,v]) => v !== undefined).map(([k,v]) => [k,String(v)]));
    return http.get(`/admin/${resource}`, listEnvelope(schemas[resource] as z.ZodTypeAny), query);
  }
  async function reservation(id: string, sensitive = false) {
    const off = disabled(); if (off) return off;
    const access = await options.loadAccess();
    if (!access.adminAllowed || (sensitive && !access.sensitiveAllowed)) return failure("forbidden");
    const result = await http.get(`/admin/reservations/${id}`, providerEnvelope(adminReservationSchema));
    if (!result.ok) return result;
    if (result.data.data.id !== id) return failure("invalid_response");
    const permission = authorizeCentralReservation(access, result.data.data, sensitive);
    if (!permission.ok) return failure(permission.kind);
    return result;
  }
  async function statement(id: string) {
    const allowed = await reservation(id); if (!allowed.ok) return allowed;
    const result = await http.get(`/admin/reservations/${id}/statement`, statementEnvelope); if (!result.ok) return result;
    const access = await options.loadAccess();
    const permission = authorizeCentralReservation(access, allowed.data.data);
    if (!permission.ok) return failure(permission.kind);
    if (result.data.data.reservation.id !== id || result.data.data.property?.id !== allowed.data.data.property_id || !result.data.data.owners.some(o => o.owner_id === permission.project.core_owner_id)) return failure("ambiguous_link");
    return result;
  }
  async function titular(id: string, scopes: string[]) {
    const allowed = await reservation(id, true); if (!allowed.ok) return allowed;
    if (!scopes.includes("admin:read") || !scopes.includes("admin:sensitive")) return failure("forbidden");
    const result = await http.get(`/admin/reservations/${id}/checkin`, providerEnvelope(adminCheckinSchema)); if (!result.ok) return result;
    if (result.data.data.reservation_id !== id) return failure("invalid_response");
    const current = authorizeCentralReservation(await options.loadAccess(), allowed.data.data, true);
    if (!current.ok) return failure(current.kind);
    return { ...result, data: restrictedTitular(result.data.data, true, scopes) };
  }
  return { list, reservation, statement, titular };
}