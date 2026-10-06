import { getSupabasePublicBrowserClient } from "./supabase-client";

export async function saveOwnerPropertyPatch(token: string, patch: Record<string, unknown>) {
  const client = getSupabasePublicBrowserClient();
  if (!client) throw new Error("Serviço indisponível");
  const { data, error } = await client.rpc("owner_property_details_save_by_token", { p_token: token, p_data: patch as never });
  if (error) throw error;
  return data as Record<string, unknown>;
}