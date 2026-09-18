/**
 * Autenticação real do PROPRIETÁRIO (Fase 17H) — diferente de
 * `src/lib/auth/session.ts` (time interno): aqui a conta nasce depois do
 * auto-cadastro (Fase 8/16), no mesmo portal público, com o mesmo token
 * do convite provando que quem está criando a senha é quem recebeu o
 * link. Nunca existe login de proprietário sem essa prova — não dá para
 * criar conta "solta" sem token.
 *
 * Vínculo de verdade sempre pela RPC `owner_account_link` (migration
 * 0013, `security definer`) — nunca um `insert` direto em
 * `owner_portal_accounts` pelo cliente (a tabela não tem policy de
 * insert para ninguém além dessa função).
 */

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "../api/supabase-client";

export interface OwnerPortalAccount {
  id: string;
  ownerId: string;
  createdAt: string;
}

interface OwnerPortalAccountRow {
  id: string;
  owner_id: string;
  created_at: string;
}

function accountFromRow(row: OwnerPortalAccountRow): OwnerPortalAccount {
  return { id: row.id, ownerId: row.owner_id, createdAt: row.created_at };
}

/**
 * Cria a conta no Supabase Auth e, na sequência, vincula ao proprietário
 * via o MESMO token do convite. Se o e-mail já tiver conta, `signUp`
 * falha antes de chegar ao vínculo — nunca finge sucesso.
 */
export async function createOwnerAccountAndLink(
  email: string,
  password: string,
  token: string,
): Promise<{ session: Session | null; account: OwnerPortalAccount | null }> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase não configurado");

  const { data: signUpData, error: signUpError } = await client.auth.signUp({ email, password });
  if (signUpError) throw signUpError;

  if (!signUpData.session) {
    // Supabase pode exigir confirmação de e-mail antes de abrir sessão —
    // sem sessão, `owner_account_link` (que exige `auth.uid()`) não pode
    // rodar ainda. A conta existe, mas o vínculo fica para o primeiro
    // login depois da confirmação.
    return { session: null, account: null };
  }

  const { data, error } = await client.rpc("owner_account_link", { p_token: token });
  if (error) throw error;
  return { session: signUpData.session, account: accountFromRow(data as OwnerPortalAccountRow) };
}

export async function ownerSignInWithPassword(email: string, password: string): Promise<Session> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase não configurado");
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("Login não retornou sessão");
  return data.session;
}

export async function ownerSignOut(): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) return;
  await client.auth.signOut();
}

export async function getCurrentOwnerSession(): Promise<Session | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

/** A própria conta do proprietário logado — RLS só deixa ver `id = auth.uid()`. */
export async function getOwnerPortalAccount(): Promise<OwnerPortalAccount | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data, error } = await client
    .from("owner_portal_accounts")
    .select()
    .maybeSingle<OwnerPortalAccountRow>();
  if (error) throw error;
  return data ? accountFromRow(data) : null;
}

export interface OwnerAuthState {
  status: "loading" | "not_required" | "authenticated" | "unauthenticated";
  session: Session | null;
  account: OwnerPortalAccount | null;
}

export function useOwnerSession(): OwnerAuthState {
  const [state, setState] = useState<OwnerAuthState>({
    status: isSupabaseConfigured() ? "loading" : "not_required",
    session: null,
    account: null,
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    const client = getSupabaseBrowserClient();
    if (!client) return;

    const apply = async (session: Session | null) => {
      if (!session) {
        if (!cancelled) setState({ status: "unauthenticated", session: null, account: null });
        return;
      }
      const account = await getOwnerPortalAccount().catch(() => null);
      if (!cancelled) setState({ status: "authenticated", session, account });
    };

    void getCurrentOwnerSession().then(apply);
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => void apply(session));
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}

export { isSupabaseConfigured };
