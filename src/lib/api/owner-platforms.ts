import { getSupabaseBrowserClient } from "./supabase-client";

/** Canais de distribuição. Airbnb é sempre incluso (padrão da operação STAYO). */
export type DistributionChannel = "airbnb" | "booking" | "decolar" | "direct";

export const ALL_CHANNELS: DistributionChannel[] = ["airbnb", "booking", "decolar", "direct"];

export const OPTIONAL_CHANNELS: Array<{ key: Exclude<DistributionChannel, "airbnb">; label: string }> = [
  { key: "booking", label: "Booking.com" },
  { key: "decolar", label: "Decolar" },
  { key: "direct", label: "Reservas diretas STAYO" },
];

export const CHANNEL_LABELS: Record<DistributionChannel, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  decolar: "Decolar",
  direct: "Reservas diretas STAYO",
};

/** Cópia viva da etapa de plataformas; fica aqui para as telas não divergirem. */
export const PLATFORM_COPY = {
  airbnbHighlights: [
    "Perfil, calendário e mensagens no lugar",
    "Política de preços e calendário de disponibilidade",
    "Fotos e textos revisados pela STAYO",
  ],
  disclosureTitle: "O que muda com outros canais",
  disclosure: [
    "Cada canal tem sua taxa de serviço e seus prazos de repasse.",
    "Calendários extras exigem sincronização para evitar conflito de agenda.",
    "Reservas diretas dependem de contrato, NF e política de cancelamento próprios.",
  ],
  /** Nota discreta na tela do proprietário quando a STAYO já definiu os canais. */
  lockedHint: "Definido pela STAYO para este imóvel",
};

/** Mesmo critério aceito pela RPC no banco, para a tela não prometer o que o banco recusa. */
const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/**
 * `null` = todas as plataformas liberadas (comportamento histórico dos imóveis
 * já cadastrados). Airbnb é sempre permitido: a operação não anuncia sem ele.
 */
export function isChannelAllowed(channel: DistributionChannel, allowed: DistributionChannel[] | null | undefined): boolean {
  if (allowed == null) return true;
  return channel === "airbnb" || allowed.includes(channel);
}

/** Mantém a ordem canônica dos canais (Airbnb primeiro). */
export function orderChannels(channels: readonly DistributionChannel[]): DistributionChannel[] {
  return ALL_CHANNELS.filter((channel) => channels.includes(channel));
}

/** Remove o que a STAYO não liberou; Airbnb continua incluso por padrão. */
export function filterAllowedChannels(
  channels: readonly DistributionChannel[],
  allowed: DistributionChannel[] | null | undefined,
): DistributionChannel[] {
  const withAirbnb = new Set<DistributionChannel>(["airbnb", ...channels]);
  return orderChannels([...withAirbnb].filter((channel) => isChannelAllowed(channel, allowed)));
}

export interface OwnerPlatforms {
  channels: DistributionChannel[] | null;
  airbnbEmail: string | null;
  /** Plataformas liberadas pela STAYO; `null` = todas. */
  allowedChannels: DistributionChannel[] | null;
}

function client() {
  const value = getSupabaseBrowserClient();
  if (!value) throw new Error("Plataformas indisponíveis");
  return value;
}

function toChannels(value: unknown): DistributionChannel[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((channel): channel is DistributionChannel => typeof channel === "string");
}

function fromRpc(row: unknown): OwnerPlatforms {
  const data = (row ?? {}) as Record<string, unknown>;
  return {
    channels: toChannels(data["channels"]),
    airbnbEmail: data["airbnbEmail"] ? String(data["airbnbEmail"]) : null,
    allowedChannels: toChannels(data["allowedChannels"]),
  };
}

/** Resolve a resposta salva do proprietário a partir do token do convite. */
export async function resolveOwnerPlatforms(token: string): Promise<OwnerPlatforms> {
  const { data, error } = await client().rpc("owner_platforms_resolve", { p_token: token });
  if (error) throw new Error(error.message);
  return fromRpc(data);
}

/** Salva canais + e-mail da conta Airbnb (RPC recusa canal fora da liberação da STAYO). */
export async function saveOwnerPlatforms(
  token: string,
  channels: DistributionChannel[],
  airbnbEmail: string,
): Promise<OwnerPlatforms> {
  const { data, error } = await client().rpc("owner_platforms_save", {
    p_token: token,
    p_channels: channels,
    p_airbnb_email: airbnbEmail,
  });
  if (error) throw new Error(error.message);
  return fromRpc(data);
}

/** Leitura da ficha: resposta do proprietário + liberação da STAYO, sem token. */
export async function getImplementationPlatforms(implementationId: string): Promise<{
  implementation_id: string;
  distribution_channels: DistributionChannel[] | null;
  airbnb_account_email: string | null;
  allowed_channels: DistributionChannel[] | null;
  distribution_updated_at: string | null;
  distribution_updated_by: string | null;
}> {
  const { data, error } = await client()
    .from("implementation_projects")
    .select(
      "id, distribution_channels, airbnb_account_email, allowed_channels, distribution_updated_at, distribution_updated_by",
    )
    .eq("id", implementationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    implementation_id: String(data?.id ?? implementationId),
    distribution_channels: toChannels(data?.distribution_channels),
    airbnb_account_email: data?.airbnb_account_email ? String(data.airbnb_account_email) : null,
    allowed_channels: toChannels(data?.allowed_channels),
    distribution_updated_at: data?.distribution_updated_at ? String(data.distribution_updated_at) : null,
    distribution_updated_by: data?.distribution_updated_by ? String(data.distribution_updated_by) : null,
  };
}

/**
 * Define quais plataformas a STAYO libera para este imóvel (Admin/Operações).
 * `null` libera todas. Airbnb é sempre mantido, e o que sair da liberação é
 * podado da escolha do proprietário por trigger no banco.
 */
export async function setImplementationAllowedChannels(
  implementationId: string,
  allowed: DistributionChannel[] | null,
): Promise<void> {
  if (allowed !== null) {
    const unknown = allowed.filter((channel) => !ALL_CHANNELS.includes(channel));
    if (unknown.length) throw new Error(`Canais desconhecidos: ${unknown.join(", ")}`);
    if (!allowed.includes("airbnb")) throw new Error("Airbnb é sempre uma plataforma liberada.");
  }
  const { error } = await client()
    .from("implementation_projects")
    .update({ allowed_channels: allowed })
    .eq("id", implementationId);
  if (error) throw new Error(error.message);
}
