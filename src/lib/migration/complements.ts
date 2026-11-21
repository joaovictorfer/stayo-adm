const temporaryFunctions = new Set(["painel-migracao", "migrate-sql", "admin-credentials"]);

export function customSecretNames(names: string[]): string[] {
  // Explicit inventory verified through the platform's names-only secret listing.
  // New project secrets must be verified there before joining this allowlist.
  const configured = new Set(["PAGARME_PUBLIC_KEY", "PAGARME_SECRET_KEY", "STAYO_API_TOKEN", "STAYO_CREDENTIAL_ENCRYPTION_KEY", "STAYO_WEBHOOK_SECRET"]);
  const system = new Set(["PATH", "HOME", "HOSTNAME", "PORT", "TMPDIR", "USER", "LANG", "TERM", "_", "NODE_ENV", "PWD", "SHELL", "SHLVL"]);
  return [...new Set(names)].filter((name) => {
    const key = name.toUpperCase();
    return configured.has(name) && /^[A-Z_][A-Z0-9_]*$/.test(key) && !system.has(key)
      && !/^(SUPABASE_|VITE_|DENO_|XDG_|CF_|CLOUDFLARE_|LOVABLE_|NPM_|BUN_)/.test(key)
      && !/(SERVICE.?ROLE|DATABASE|DB_|POSTGRES|PGPASSWORD|PGHOST|PGPORT|PGUSER|PGDATABASE|ADMIN.*(KEY|TOKEN|SECRET)|SECRET.*SUPABASE)/.test(key);
  }).sort();
}

export function exportableFunctions(files: Record<string, string>) {
  return Object.entries(files).flatMap(([path, code]) => {
    const name = path.match(/\/functions\/([^/]+)\/index\.ts$/)?.[1];
    if (!name || temporaryFunctions.has(name)) return [];
    const localImports = [...code.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)["'](\.[^"']+)["']/g)]
      .flatMap((match) => match[1] ? [match[1]] : []);
    return [{ name, code, localImports: [...new Set(localImports)] }];
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function consolidateFunctions(files: Record<string, string>): string {
  return exportableFunctions(files).map(({ name, code }) => `// ═══ ${name} ═══\n${code}`).join("\n\n");
}