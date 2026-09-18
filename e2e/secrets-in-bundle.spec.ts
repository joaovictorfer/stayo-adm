import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

/**
 * Fase 18: nenhum segredo (service_role, credencial, token privado) pode
 * acabar no bundle que vai para o navegador — a regra do plano mestre é
 * "só VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY são público-seguras,
 * nunca service_role em VITE_*". Este teste builda o app de verdade
 * (mesmo comando de produção) e varre a saída publicável procurando os
 * padrões que nunca deveriam aparecer ali.
 *
 * Não precisa de servidor (não usa `page`) — roda via Playwright só para
 * ficar junto do resto da suíte E2E da Fase 18, mas é puro Node.
 */

// Padrões de VALOR de segredo, não de string de biblioteca — ex:
// @supabase/supabase-js embute `e.startsWith('sb_secret_')` no próprio
// client-side (checagem de prefixo, não um segredo), então o padrão exige
// caracteres de chave de verdade depois do prefixo, nunca o prefixo cru.
const FORBIDDEN_PATTERNS: RegExp[] = [
  /"role"\s*:\s*"service_role"/i,
  /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][^"']+["']/i,
  /sb_secret_[a-zA-Z0-9_-]{10,}/,
  /-----BEGIN[ A-Z]*PRIVATE KEY-----/,
];

function collectTextFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectTextFiles(full, out);
    else if (/\.(js|mjs|cjs|css|html|json)$/.test(entry)) out.push(full);
  }
  return out;
}

test("build de produção nunca inclui service_role ou outro segredo", () => {
  execSync("bun run build", { cwd: process.cwd(), stdio: "pipe" });

  const publicDir = join(process.cwd(), ".output", "public");
  const files = collectTextFiles(publicDir);
  expect(files.length).toBeGreaterThan(0);

  const offenders: string[] = [];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) offenders.push(`${file} matches ${pattern}`);
    }
  }
  expect(offenders).toEqual([]);
});
