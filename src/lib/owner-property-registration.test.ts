import { describe, expect, it } from "vitest";
import { hasOwnerChanges, propertyPatch, propertyRegistrationErrors } from "./owner-property-registration";
import { computeRegistrationProgress } from "./owner-registration-progress";

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
  it("progress goes up and down with real requirements, not address or box", () => {
    const percent = (form: typeof complete | (Omit<typeof complete, "propertyLavatories"> & { propertyLavatories: null })) => computeRegistrationProgress({ owner: { done: 1, total: 1 }, property: { done: 6 - Object.keys(propertyRegistrationErrors(form)).length, total: 6 }, platformsDone: true, prepAnswers: [] }).percent;
    expect(percent(complete)).toBe(100);
    expect(percent({ ...complete, propertyLavatories: null })).toBeLessThan(100);
    expect(percent({ ...complete, propertyParkingBox: "" })).toBe(100);
  });
});