import { getSupabaseBrowserClient } from "./supabase-client";

/** Canais de distribuição. Airbnb é sempre incluso (padrão da operação STAYO). */
export type DistributionChannel = "airbnb" | "booking" | "decolar" | "direct";

export const OPTIONAL_CHANNELS: Array<{ key: Exclude<DistributionChannel, "airbnb">; label: string }> = [
  { key: "booking", label: "Booking" },
  { key: "decolar", label: "Decolar" },
  { key: "direct", label: "Reservas diretas STAYO" },
];

export const CHANNEL_LABELS: Record<DistributionChannel, string> = {
  airbnb: "Airbnb",
  booking: "Booking",
  decolar: "Decolar",
  direct: "Reservas diretas STAYO",
};

/** Textos únicos sobre proteção, vistorias e repasses — reutilizar em qualquer tela. */
export const PLATFORM_COPY = {
  airbnbHighlights: ["Proteção AirCover", "Repasse direto ao proprietário, sem passar pela STAYO"],
  disclosureTitle: "Proteção, vistorias e repasses",
  disclosure: [
    "O Airbnb possui proteção AirCover.",
    "Nas reservas via Airbnb, o repasse é feito pela própria plataforma, diretamente ao proprietário.",
    "Booking, Decolar e Reservas diretas STAYO não possuem a mesma proteção AirCover.",
    "Nesses canais, a STAYO faz vistoria de check-in e check-out para identificar possíveis danos.",
    "Mesmo com as vistorias, recomendamos avaliar a contratação de um seguro próprio para o imóvel.",
  ],
};

export interface OwnerPlatforms {
  channels: DistributionChannel[] | null;
  airbnbEmail: string | null;
}

export const isValidEmail = (value: string) =>
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value.trim());

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Serviço indisponível");
  return supabase;
}

export async function resolveOwnerPlatforms(token: string): Promise<OwnerPlatforms> {
  const { data, error } = await client().rpc("owner_platforms_resolve", { p_token: token });
  if (error) throw error;
  const row = (data ?? {}) as { channels?: DistributionChannel[] | null; airbnbEmail?: string | null };
  return { channels: row.channels ?? null, airbnbEmail: row.airbnbEmail ?? null };
}

export async function saveOwnerPlatforms(
  token: string,
  channels: DistributionChannel[],
  airbnbEmail: string,
): Promise<OwnerPlatforms> {
  const { data, error } = await client().rpc("owner_platforms_save", {
    p_token: token,
    p_channels: channels,
    p_airbnb_email: airbnbEmail.trim() || null,
  } as never);
  if (error) throw error;
  const row = (data ?? {}) as { channels?: DistributionChannel[] | null; airbnbEmail?: string | null };
  return { channels: row.channels ?? null, airbnbEmail: row.airbnbEmail ?? null };
}

/** Leitura administrativa (RLS do Admin) para exibir na ficha de implantação. */
export async function getImplementationPlatforms(implementationId: string) {
  const { data, error } = await client()
    .from("implementation_projects")
    .select("distribution_channels, airbnb_account_email, distribution_updated_at, distribution_updated_by")
    .eq("id", implementationId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    distribution_channels: DistributionChannel[] | null;
    airbnb_account_email: string | null;
    distribution_updated_at: string | null;
    distribution_updated_by: string | null;
  } | null;
}
