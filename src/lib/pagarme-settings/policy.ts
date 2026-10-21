export function isSettingsAdmin(allowed: unknown, error: unknown) { return !error && allowed === true; }
/** Accepts Pagar.me secret keys (test `sk_test_` or production `sk_`), authorized by the owner on 2026-10-21. */
export function acceptsSandboxCredential(value: unknown): value is string {
  return typeof value === 'string' && /^sk_[A-Za-z0-9_-]+$/.test(value) && value.length <= 512;
}
export function isProductionCredential(value: string) { return !value.startsWith('sk_test_'); }
