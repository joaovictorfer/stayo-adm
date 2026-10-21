import { it, expect } from 'vitest';
import { encryptCredential, decryptCredential } from './vault.server';
it('encrypted credential roundtrip requires the correct encryption key', async () => {
  const fixture = 'unit-test-only-value';
  const encrypted = await encryptCredential(fixture, 'unit-test-encryption-only');
  expect(encrypted.includes(fixture)).toBe(false);
  expect(await decryptCredential(encrypted, 'unit-test-encryption-only')).toBe(fixture);
  await expect(decryptCredential(encrypted, 'different-test-key')).rejects.toThrow();
});