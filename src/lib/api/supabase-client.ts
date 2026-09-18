/**
 * Fábrica do client de browser do Supabase — único lugar que lê as
 * variáveis de ambiente do Supabase e decide se ele está configurado.
 *
 * Nenhuma tela deve importar `@supabase/supabase-js` diretamente; sempre
 * passar por `getSupabaseBrowserClient()` (ou por `admin-client.ts`, que já
 * decide mock-vs-real por trás desta mesma checagem).
 *
 * Segurança: só a chave `anon` (pública, protegida por RLS) roda no
 * browser. A `service_role` nunca deve existir em código de frontend —
 * ver docs/SECURITY_AND_RLS.md.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * O Lovable Cloud gera `VITE_SUPABASE_PUBLISHABLE_KEY` (formato novo de chave
 * do Supabase, `sb_publishable_...`) — `VITE_SUPABASE_ANON_KEY` (JWT antigo)
 * fica como alias por compatibilidade, caso alguém configure manualmente com
 * o nome antigo.
 */
function supabaseAnonKey(): string | undefined {
  return (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    import.meta.env["VITE_SUPABASE_ANON_KEY"]) as string | undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env["VITE_SUPABASE_URL"] && supabaseAnonKey());
}

let cached: SupabaseClient | null = null;

/** Retorna `null` quando o Supabase ainda não está configurado — nunca lança. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (cached) return cached;

  cached = createClient(
    import.meta.env["VITE_SUPABASE_URL"] as string,
    supabaseAnonKey() as string,
  );
  return cached;
}
