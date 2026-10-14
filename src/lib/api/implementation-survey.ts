import { supabase } from "@/integrations/supabase/client";
import { hashToken } from "./token-hash";

export interface SurveyItem {
  id: string;
  room: string;
  category: string;
  name: string;
  tip: string | null;
  answer: "tenho" | "nao_tenho" | "nao_aplica" | null;
  quantity: number | null;
  brand: string | null;
  condition: string | null;
  notes: string | null;
}

export interface SurveyData {
  implementation: { id: string; name: string };
  items: SurveyItem[];
  brands: string[];
  notes: string[];
}

export async function resolveSurvey(token: string): Promise<SurveyData> {
  const { data, error } = await supabase.rpc("survey_resolve", { p_token: token });
  if (error) throw new Error("Link inválido ou expirado");
  return data as unknown as SurveyData;
}

export async function saveSurveyItem(token: string, item: SurveyItem) {
  const { error } = await supabase.rpc("survey_save_item", {
    p_token: token,
    p_item_id: item.id,
    p_answer: item.answer as string,
    p_quantity: item.quantity as number,
    p_brand: item.brand as string,
    p_condition: item.condition as string,
    p_notes: item.notes as string,
  });
  if (error) throw error;
}

export async function addSurveyNotePreset(token: string, text: string) {
  const { error } = await supabase.rpc("survey_add_note_preset", { p_token: token, p_text: text });
  if (error) throw error;
}

/** Equipe STAYO cria um link dedicado (30 dias). O token só existe na URL. */
export async function createSurveyLink(implementationId: string): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("implementation_survey_links").insert({
    implementation_id: implementationId,
    token_hash: await hashToken(token),
    created_by: u.user?.id ?? null,
  });
  if (error) throw error;
  return token;
}
