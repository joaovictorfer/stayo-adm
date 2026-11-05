import { supabase } from "@/integrations/supabase/client";
import type { Decision, StoredDecision } from "../field-sources";

/** Decisões da equipe sobre divergências (Usar oficial / Conferir no local), por ficha. */
export async function listFieldDecisions(implementationId: string): Promise<Record<string, StoredDecision>> {
  const { data, error } = await supabase
    .from("implementation_field_confirmations")
    .select("field_key,note,value_snapshot")
    .eq("implementation_id", implementationId)
    .like("field_key", "div:%");
  if (error) throw error;
  return Object.fromEntries(
    (data ?? [])
      .filter((r) => r.note === "usar_oficial" || r.note === "conferir_local")
      .map((r) => [r.field_key.slice(4), { decision: r.note as Decision, snapshot: r.value_snapshot ?? "" }]),
  );
}

export async function saveFieldDecision(implementationId: string, key: string, decision: Decision, snapshot: string) {
  const { error } = await supabase.from("implementation_field_confirmations").upsert(
    { implementation_id: implementationId, field_key: `div:${key}`, state: "reviewed_by_stayo", note: decision, value_snapshot: snapshot, updated_at: new Date().toISOString() },
    { onConflict: "implementation_id,field_key" },
  );
  if (error) throw error;
}

export const fieldDecisionsQuery = (implementationId: string) => ({
  queryKey: ["field-decisions", implementationId],
  queryFn: () => listFieldDecisions(implementationId),
});
