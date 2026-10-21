import { describe, it, expect } from 'vitest';
import { isSettingsAdmin, acceptsSandboxCredential } from './policy';
describe('Pagar.me settings access', () => {
  it('requires explicit administrator authorization, rejects null and errors', () => {
    expect(isSettingsAdmin(true, null)).toBe(true);
    expect(isSettingsAdmin(null, null)).toBe(false);
    expect(isSettingsAdmin(false, null)).toBe(false);
    expect(isSettingsAdmin(true, new Error())).toBe(false);
  });
  it('accepts test and production secret keys, rejects public keys', () => {
    expect(acceptsSandboxCredential('sk_test_unit_fixture')).toBe(true);
    expect(acceptsSandboxCredential('sk_unit_fixture')).toBe(true);
    expect(acceptsSandboxCredential('pk_unit_fixture')).toBe(false);
    expect(acceptsSandboxCredential('')).toBe(false);
    expect(acceptsSandboxCredential(null)).toBe(false);
  });
});