import { getSupabaseBrowserClient } from "./supabase-client";

export type OwnerAddress = {
  postalCode: string; street: string; number: string; complement: string;
  district: string; city: string; state: string;
};

/** Address-only write to the existing contract profile; never replays personal or payment data. */
export async function saveOwnerAddress(implementationId: string, address: OwnerAddress) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Cadastro indisponível.");
  const { error } = await client.from("owner_onboarding_profiles").upsert({
    implementation_id: implementationId,
    postal_code: address.postalCode.replace(/\D/g, "") || null,
    street: address.street.trim() || null,
    number: address.number.trim() || null,
    complement: address.complement.trim() || null,
    district: address.district.trim() || null,
    city: address.city.trim() || null,
    state: address.state.trim().toUpperCase() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "implementation_id" });
  if (error) throw error;
}