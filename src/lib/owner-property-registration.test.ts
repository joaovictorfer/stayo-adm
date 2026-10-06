import { describe, expect, it } from "vitest";
import { hasOwnerChanges, propertyPatch, propertyRegistrationErrors } from "./owner-property-registration";
import { computeRegistrationProgress } from "./owner-registration-progress";
import { readFileSync } from "node:fs";

const complete = { propertyCondominiumName: "Condomínio teste", propertyUnit: "01", propertyParkingBox: "B-02", propertyBedrooms: 0, propertyBathrooms: 0, propertySuites: 0, propertyLavatories: 0 };
describe("property registration 03A", () => {
  it("zero is answered for every room count", () => expect(propertyRegistrationErrors(complete)).toEqual({}));
  it("null is different from zero", () => expect(propertyRegistrationErrors({ ...complete, propertyBedrooms: null }).propertyBedrooms).toBeTruthy());
  it("Box remains optional text", () => {
    expect(propertyRegistrationErrors({ ...complete, propertyParkingBox: "" })).toEqual({});
    expect(propertyPatch(complete, { ...complete, propertyParkingBox: "A-007" })).toEqual({ propertyParkingBox: "A-007", _expected: { propertyParkingBox: "B-02" } });
  });
  it("only the changed field is patched", () => expect(propertyPatch(complete, { ...complete, propertyBedrooms: 3 })).toEqual({ propertyBedrooms: 3, _expected: { propertyBedrooms: 0 } }));
  it("reload and equivalent whitespace do not write", () => {
    expect(propertyPatch(complete, { ...complete })).toBeNull();
    expect(propertyPatch(complete, { ...complete, propertyUnit: "01 " })).toBeNull();
  });
  it("linked condominium cannot be patched", () => expect(propertyPatch({ ...complete, propertyCondominiumLinked: true }, { ...complete, propertyCondominiumLinked: true, propertyCondominiumName: "Other" })).toBeNull());
  it("property edit never saves personal data", () => expect(hasOwnerChanges(complete, { ...complete, propertyParkingBox: "9" })).toBe(false));
  it("absent address, type and credentials never enter the PATCH", () => {
    const existing = { ...complete, propertyStreet: "Rua preservada", propertyType: "apartamento", wifiPassword: "fixture-only" };
    const patch = propertyPatch(existing, { ...existing, propertyParkingBox: "C-01" });
    expect(patch).toEqual({ propertyParkingBox: "C-01", _expected: { propertyParkingBox: "B-02" } });
    expect(existing.propertyStreet).toBe("Rua preservada");
    expect(existing.propertyType).toBe("apartamento");
  });
  it("progress goes up and down with real requirements, not address or box", () => {
    const percent = (form: typeof complete | (Omit<typeof complete, "propertyLavatories"> & { propertyLavatories: null })) => computeRegistrationProgress({ owner: { done: 1, total: 1 }, property: { done: 6 - Object.keys(propertyRegistrationErrors(form)).length, total: 6 }, platformsDone: true, prepAnswers: [] }).percent;
    expect(percent(complete)).toBe(100);
    expect(percent({ ...complete, propertyLavatories: null })).toBeLessThan(100);
    expect(percent({ ...complete, propertyParkingBox: "" })).toBe(100);
  });
});

describe("applied migration 03A safety contract (static, not database execution)", () => {
  const sql = readFileSync(new URL("../../drizzle/migrations/0052_owner_property_non_sensitive_patch.sql", import.meta.url), "utf8");
  const save = sql.split("CREATE OR REPLACE FUNCTION public.owner_property_details_save_by_token")[1]?.split("CREATE OR REPLACE FUNCTION public.property_details_canonical_bedrooms")[0] ?? "";
  it("PATCH iterates only provided keys and whitelists non-sensitive fields", () => {
    expect(save).toContain("jsonb_each(p_data)");
    expect(save).toContain("IF k NOT IN ('propertyCondominiumName','propertyUnit','propertyParkingBox','propertyBedrooms','propertyBathrooms','propertySuites','propertyLavatories') THEN CONTINUE");
    for (const column of ["street", "property_type", "access_code", "wifi_network", "wifi_password", "condominium_id"]) {
      expect(save).not.toMatch(new RegExp(`SET ${column}=`));
    }
  });
  it("linked condominium and stale STAYO values are guarded", () => {
    expect(save).toContain("k='propertyCondominiumName' AND p.condominium_id IS NOT NULL");
    expect(save).toContain("(expected->k) IS DISTINCT FROM (current_data->k)");
    expect(save).toContain("ERRCODE='40001'");
  });
  it("canonical bedroom source and zero validation are explicit", () => {
    expect(sql).toContain("'propertyBedrooms',p.bedrooms");
    expect(save).toContain("n<0 OR n>30");
    expect(save).toContain("UPDATE public.implementation_projects SET bedrooms=");
    expect(sql).toContain("SELECT bedrooms INTO NEW.bedrooms FROM public.implementation_projects");
  });
  it("invitation expiry, revocation, hash and confirmed proposal remain required", () => {
    expect(save).toContain("token_hash=encode(digest(p_token,'sha256'),'hex') AND revoked_at IS NULL AND expires_at>=now()");
    expect(save).toContain("NOT public.owner_journey_current_confirmed(v_id)");
  });
});