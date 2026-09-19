/**
 * Hash de token de convite — nunca guardamos o token em texto puro.
 * SHA-256 via Web Crypto, disponível no browser e no runtime do servidor
 * (Node 20+/Cloudflare Workers) sem dependência extra.
 */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Token público com 256 bits de entropia, codificado sem caracteres problemáticos em URLs. */
export function createSecureToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
