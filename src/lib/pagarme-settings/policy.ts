export function isSettingsAdmin(allowed: unknown, error: unknown) { return !error && allowed === true; }
export function acceptsSandboxCredential(value: unknown): value is string {
  return typeof value === 'string' && /^sk_test_[A-Za-z0-9_-]+$/.test(value) && value.length <= 512;
}