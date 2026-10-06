export const PROPERTY_REQUIRED = ["propertyCondominiumName", "propertyUnit", "propertyBedrooms", "propertyBathrooms", "propertySuites", "propertyLavatories"] as const;
export const PROPERTY_EDITABLE = [...PROPERTY_REQUIRED, "propertyParkingBox"] as const;
export type PropertyKey = typeof PROPERTY_EDITABLE[number];
export type PropertyRegistration = Partial<Record<PropertyKey, string | number | null>> & { propertyCondominiumLinked?: boolean };
const normalized = (value: unknown) => typeof value === "string" ? value.trim() || null : value ?? null;

/** Only changed, non-sensitive fields plus per-field optimistic conflict baselines. */
export function propertyPatch(before: PropertyRegistration, after: PropertyRegistration) {
  const patch: Record<string, unknown> = {};
  const expected: Record<string, unknown> = {};
  for (const key of PROPERTY_EDITABLE) {
    if (key === "propertyCondominiumName" && after.propertyCondominiumLinked) continue;
    if (normalized(before[key]) !== normalized(after[key])) {
      patch[key] = normalized(after[key]);
      expected[key] = normalized(before[key]);
    }
  }
  return Object.keys(patch).length ? { ...patch, _expected: expected } : null;
}

export function propertyRegistrationErrors(form: PropertyRegistration) {
  const errors: Partial<Record<typeof PROPERTY_REQUIRED[number], string>> = {};
  for (const key of PROPERTY_REQUIRED) {
    const value = form[key];
    if (key === "propertyCondominiumName" || key === "propertyUnit") {
      if (typeof value !== "string" || !value.trim()) errors[key] = "Informe este dado.";
    } else if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 30) {
      errors[key] = "Informe a quantidade, inclusive zero.";
    }
  }
  return errors;
}

export function hasOwnerChanges(before: Record<string, unknown>, after: Record<string, unknown>) {
  const ownerOnly = (form: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(form).filter(([key]) => !key.startsWith("property") && !["implementationId", "currentStep", "submittedAt"].includes(key))));
  return ownerOnly(before) !== ownerOnly(after);
}