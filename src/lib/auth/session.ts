/**
 * Autenticação real do time interno (Fase 17 — Supabase Auth).
 *
 * Só faz algo quando `isSupabaseConfigured()` for verdadeiro — sem
 * Supabase, `useAuthSession()` resolve para `"not_required"` (nenhum
 * gate, o app continua funcionando exatamente como antes, sobre o
 * adapter local — mesmo princípio de todo o resto do `AdminApiClient`).
 *
 * Autorização de verdade nunca vem daqui: este módulo só decide se
 * existe uma sessão e busca o `AdminProfile` associado para exibição —
 * quem decide o que cada papel pode fazer é sempre a RLS no banco
 * (`has_admin_role(...)`, ver docs/AUTH_AND_ROLES.md).
 */

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "../api/supabase-client";
import type { AdminProfile } from "../../types/admin";

interface AdminProfileRow {
  id: string;
  full_name: string;
  role: AdminProfile["role"];
  active: boolean;
}

function profileFromRow(row: AdminProfileRow): AdminProfile {
  return { id: row.id, fullName: row.full_name, role: row.role, active: row.active };
}

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase não configurado");
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("Login não retornou sessão");
  return data.session;
}

export async function signOut(): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) return;
  await client.auth.signOut();
}

export async function getCurrentSession(): Promise<Session | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const client = getSupabaseBrowserClient();
  if (!client) return () => {};
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => callback(session));
  return () => subscription.unsubscribe();
}

export async function getAdminProfile(userId: string): Promise<AdminProfile | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data, error } = await client
    .from("admin_profiles")
    .select()
    .eq("id", userId)
    .maybeSingle<AdminProfileRow>();
  if (error) throw error;
  return data ? profileFromRow(data) : null;
}

/**
 * Só funciona (via RLS — migration 0008) se `admin_profiles` ainda
 * estiver vazia. Falha silenciosamente (retorna `null`) caso contrário:
 * a conta no Supabase Auth foi criada, mas precisa ser liberada por um
 * `super_admin` existente antes de acessar o Admin.
 */
export async function tryBootstrapFirstSuperAdmin(
  userId: string,
  fullName: string,
): Promise<AdminProfile | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data, error } = await client
    .from("admin_profiles")
    .insert({ id: userId, full_name: fullName, role: "super_admin" })
    .select()
    .maybeSingle<AdminProfileRow>();
  if (error || !data) return null;
  return profileFromRow(data);
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
): Promise<{ session: Session | null; bootstrapped: boolean }> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase não configurado");
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  let bootstrapped = false;
  if (data.user) {
    const profile = await tryBootstrapFirstSuperAdmin(data.user.id, fullName);
    bootstrapped = profile !== null;
  }
  return { session: data.session, bootstrapped };
}

export type AuthStatus = "loading" | "not_required" | "authenticated" | "unauthenticated";

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  profile: AdminProfile | null;
}

/** `true` quando o app deveria mostrar a tela de login/gate de autenticação. */
export function requiresLoginGate(state: AuthState): boolean {
  return state.status === "unauthenticated";
}

export function useAuthSession(): AuthState {
  const [state, setState] = useState<AuthState>({
    status: isSupabaseConfigured() ? "loading" : "not_required",
    session: null,
    profile: null,
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;

    const apply = async (session: Session | null) => {
      if (!session) {
        if (!cancelled) setState({ status: "unauthenticated", session: null, profile: null });
        return;
      }
      const profile = await getAdminProfile(session.user.id).catch(() => null);
      if (!cancelled) setState({ status: "authenticated", session, profile });
    };

    void getCurrentSession().then(apply);
    const unsubscribe = onAuthStateChange((session) => void apply(session));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}
