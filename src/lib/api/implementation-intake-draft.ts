export const IMPLEMENTATION_INTAKE_DRAFT_KEY = "stayo-admin:implementation-intake-draft";

export function readImplementationIntakeDraft<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(IMPLEMENTATION_INTAKE_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveImplementationIntakeDraft(value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(IMPLEMENTATION_INTAKE_DRAFT_KEY, JSON.stringify(value));
}

export function clearImplementationIntakeDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(IMPLEMENTATION_INTAKE_DRAFT_KEY);
}