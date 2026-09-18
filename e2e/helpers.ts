import type { Page } from "@playwright/test";

/**
 * TanStack Start faz SSR — interagir com o DOM antes da hidratação do
 * React terminar é silenciosamente descartado quando a hidratação assume
 * o controle. Esperar um instante depois de qualquer navegação evita
 * flakiness sem precisar de um seletor específico por página.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(900);
}

/** SHA-256 hex, no browser — mesmo algoritmo de src/lib/api/token-hash.ts. */
export async function hashTokenInBrowser(page: Page, token: string): Promise<string> {
  return page.evaluate(async (t) => {
    const data = new TextEncoder().encode(t);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }, token);
}
