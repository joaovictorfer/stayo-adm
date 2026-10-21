const encoder = new TextEncoder();
async function keyFrom(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptCredential(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode('stayo:pagarme:sandbox:v1') }, await keyFrom(secret), encoder.encode(value));
  return JSON.stringify({ v: 1, iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) });
}
export async function decryptCredential(payload: string, secret: string) {
  const stored = JSON.parse(payload);
  if (stored.v !== 1) throw new Error('Configuração indisponível.');
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(stored.iv), additionalData: encoder.encode('stayo:pagarme:sandbox:v1') }, await keyFrom(secret), new Uint8Array(stored.data));
  return new TextDecoder().decode(decrypted);
}