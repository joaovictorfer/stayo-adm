import { getSupabaseBrowserClient } from "./supabase-client";

/** Campos da oportunidade salvos automaticamente pelo formulário da reunião. */
export const FORM_FIELDS = [
  "nickname",
  "condominium_name",
  "tower",
  "unit",
  "address",
  "city",
  "postal_code",
  "property_type",
  "bedrooms",
  "capacity",
  "notes",
  "owner_facing_notes",
] as const;
export type FormField = (typeof FORM_FIELDS)[number];
export type FormValues = Record<FormField, string>;

export interface FieldSource {
  field: string;
  source: "admin" | "owner";
  updatedAt: string;
}

export interface FieldConflict {
  field: FormField;
  current: string;
  mine: string;
}

type Rpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

function sb() {
  const c = getSupabaseBrowserClient();
  if (!c) throw new Error("O banco do Admin não está disponível.");
  return c;
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function rowToValues(row: Record<string, unknown>): FormValues {
  return Object.fromEntries(FORM_FIELDS.map((f) => [f, str(row[f])])) as FormValues;
}

export async function loadOpportunityForm(id: string): Promise<{
  values: FormValues;
  draftStep: string | null;
  sources: FieldSource[];
}> {
  const client = sb();
  const [row, src] = await Promise.all([
    client
      .from("implementation_projects")
      .select([...FORM_FIELDS, "draft_step"].join(","))
      .eq("id", id)
      .maybeSingle(),
    client
      .from("implementation_field_sources")
      .select("field, source, updated_at")
      .eq("implementation_id", id),
  ]);
  if (row.error) throw new Error(row.error.message);
  const data = (row.data ?? {}) as unknown as Record<string, unknown>;
  return {
    values: rowToValues(data),
    draftStep: (data["draft_step"] as string | null) ?? null,
    sources: ((src.data ?? []) as Array<{ field: string; source: "admin" | "owner"; updated_at: string }>).map(
      (s) => ({ field: s.field, source: s.source, updatedAt: s.updated_at }),
    ),
  };
}

export async function autosaveOpportunity(
  id: string,
  patch: Partial<Record<FormField | "draft_step", string>>,
  base: Partial<FormValues>,
): Promise<{ values: FormValues; conflicts: FieldConflict[] }> {
  const { data, error } = await (sb() as unknown as Rpc).rpc("admin_autosave_opportunity", {
    p_implementation_id: id,
    p_patch: patch,
    p_base: base,
  });
  if (error) throw new Error(error.message || "Não foi possível salvar.");
  const d = data as { row: Record<string, unknown>; conflicts: Array<{ field: FormField; current: unknown; mine: unknown }> };
  return {
    values: rowToValues(d.row ?? {}),
    conflicts: (d.conflicts ?? []).map((c) => ({ field: c.field, current: str(c.current), mine: str(c.mine) })),
  };
}
