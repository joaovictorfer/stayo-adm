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

export type OwnerAccountSetupResult =
  | { status: "linked"; session: Session; account: OwnerPortalAccount }
  | { status: "confirmation_required"; session: null; account: null };

interface OwnerPortalAccountRow {
  id: string;
  owner_id: string;
  created_at: string;
}

function accountFromRow(row: OwnerPortalAccountRow): OwnerPortalAccount {
  return { id: row.id, ownerId: row.owner_id, createdAt: row.created_at };
}

async function linkCurrentOwnerAccount(token: string): Promise<OwnerPortalAccount> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase não configurado");
  const { data, error } = await client.rpc("owner_account_link", { p_token: token });
  if (error) throw error;
  return accountFromRow(data as OwnerPortalAccountRow);
}

/** Cria ou reutiliza a conta e conclui o vínculo usando o mesmo convite. */
export async function createOwnerAccountAndLink(
  email: string,
  password: string,
  token: string,
): Promise<OwnerAccountSetupResult> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase não configurado");

  const normalizedEmail = email.trim().toLowerCase();
  const { data: signUpData, error: signUpError } = await client.auth.signUp({
    email: normalizedEmail,
    password,
    options: { emailRedirectTo: window.location.href },
  });

  let session = signUpData.session;
  if (signUpError) {
    const repeatedSignup =
      signUpError.code === "user_already_exists" ||
      signUpError.message.toLocaleLowerCase("pt-BR").includes("already registered");
    if (!repeatedSignup) throw signUpError;

    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (signInError) throw signInError;
    session = signInData.session;
  }

  if (!session) {
    return { status: "confirmation_required", session: null, account: null };
  }

  const account = await linkCurrentOwnerAccount(token);
  return { status: "linked", session, account };
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
  status: "loading" | "not_required" | "authenticated" | "unauthenticated" | "unlinked" | "error";
  session: Session | null;
  account: OwnerPortalAccount | null;
  message?: string;
  retry: () => void;
}

export function useOwnerSession(): OwnerAuthState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<OwnerAuthState>({
    status: isSupabaseConfigured() ? "loading" : "not_required",
    session: null,
    account: null,
    retry: () => setAttempt((value) => value + 1),
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    const client = getSupabaseBrowserClient();
    if (!client) return;

    const retry = () => setAttempt((value) => value + 1);
    const apply = async (session: Session | null) => {
      if (!session) {
        if (!cancelled)
          setState({ status: "unauthenticated", session: null, account: null, retry });
        return;
      }
      try {
        const account = await getOwnerPortalAccount();
        if (cancelled) return;
        if (!account) {
          setState({
            status: "unlinked",
            session,
            account: null,
            message: "Esta conta ainda não está vinculada a um proprietário.",
            retry,
          });
          return;
        }
        setState({ status: "authenticated", session, account, retry });
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            session,
            account: null,
            message: "Não foi possível confirmar seu acesso agora.",
            retry,
          });
        }
      }
    };

    void getCurrentOwnerSession().then(apply);
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      // A leitura do vínculo usa o mesmo client e precisa rodar depois que o
      // callback interno do Auth liberar seu lock.
      window.setTimeout(() => void apply(session), 0);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [attempt]);

  return state;
}

export { isSupabaseConfigured };
