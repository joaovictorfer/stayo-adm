import { getSupabaseBrowserClient } from "./supabase-client";

export type PrepAnswer = "tenho" | "nao_tenho" | "nao_aplica";

export interface PrepItem {
  id: string;
  room: string;
  name: string;
  tip: string | null;
  description: string | null;
  purchaseUrl: string | null;
  hasImage: boolean;
  /** Resposta efetiva mostrada ao proprietário (proposta pendente dele > registro da equipe). */
  answer: PrepAnswer | null;
  note: string | null;
}

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Serviço indisponível");
  return supabase;
}

export async function resolvePreparation(token: string): Promise<PrepItem[]> {
  const { data, error } = await client().rpc("owner_inventory_resolve_by_token" as never, { p_token: token } as never);
  if (error) throw error;
  const d = (data ?? {}) as {
    items?: Array<Omit<PrepItem, "note" | "answer"> & { answer: PrepAnswer | null }>;
    submissions?: Array<{ itemId: string; proposed: { answer?: PrepAnswer; note?: string } }>;
  };
  const subs = new Map((d.submissions ?? []).map((s) => [s.itemId, s.proposed]));
  return (d.items ?? []).map((i) => {
    const p = subs.get(i.id);
    return { ...i, answer: p?.answer ?? i.answer ?? null, note: p?.note ?? null };
  });
}

export async function savePreparation(token: string, itemId: string, answer: PrepAnswer | null, note: string | null) {
  const { error } = await client().rpc("owner_inventory_submit_by_token" as never, {
    p_token: token,
    p_item_id: itemId,
    p_data: { answer, note },
  } as never);
  if (error) throw error;
}
