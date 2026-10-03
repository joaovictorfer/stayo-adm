import { supabase } from "@/integrations/supabase/client";
import type { GuideAnswer, GuideClassification, GuideReview, GuideType } from "../guides";
import { guideBlock } from "../guides";

export interface GuideItemInput {
  category: string;
  name: string;
  recommended_quantity: number;
  quantity_text: string | null;
  size_text: string | null;
  description: string | null;
  tip: string | null;
  purchase_url: string | null;
  image_path: string | null;
  classification: GuideClassification;
  display_order: number;
}

export interface ImplementationGuideItem extends GuideItemInput {
  id: string;
  implementation_id: string;
  catalog_item_id: string | null;
  enabled: boolean;
  response: {
    id: string;
    answer: GuideAnswer;
    quantity: number | null;
    review_status: GuideReview;
    confirmed_quantity: number | null;
    updated_at: string;
  } | null;
}

export interface CatalogItem extends GuideItemInput {
  id: string;
  active: boolean;
}

const BUCKET = "guide-images";

export async function listGuide(implementationId: string, guideType: GuideType = "utensilios"): Promise<ImplementationGuideItem[]> {
  const [items, responses] = await Promise.all([
    supabase
      .from("implementation_guide_items")
      .select("*")
      .eq("implementation_id", implementationId)
      .eq("guide_type", guideType)
      .order("category")
      .order("display_order"),
    supabase
      .from("implementation_guide_responses")
      .select("id, guide_item_id, answer, quantity, review_status, confirmed_quantity, updated_at")
      .eq("implementation_id", implementationId),
  ]);
  if (items.error) throw items.error;
  if (responses.error) throw responses.error;
  const byItem = new Map((responses.data ?? []).map((r) => [r.guide_item_id, r]));
  return (items.data ?? []).map((i) => {
    const r = byItem.get(i.id);
    return {
      ...(i as unknown as ImplementationGuideItem),
      response: r
        ? {
            id: r.id,
            answer: r.answer as GuideAnswer,
            quantity: r.quantity,
            review_status: r.review_status as GuideReview,
            confirmed_quantity: r.confirmed_quantity,
            updated_at: r.updated_at,
          }
        : null,
    };
  });
}

export async function applyGuide(implementationId: string, guideType: GuideType = "utensilios"): Promise<number> {
  const { data, error } = await supabase.rpc("admin_apply_guide", {
    p_implementation_id: implementationId,
    p_guide_type: guideType,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function saveGuideItem(
  implementationId: string,
  id: string | null,
  input: GuideItemInput & { enabled: boolean },
  alsoCatalog: boolean,
  guideType: GuideType = "utensilios",
) {
  if (id) {
    const { error } = await supabase.from("implementation_guide_items").update(input).eq("id", id);
    if (error) throw error;
  } else {
    let catalogId: string | null = null;
    if (alsoCatalog) {
      const { enabled: _e, ...rest } = input;
      const { data, error } = await supabase
        .from("guide_catalog_items")
        .insert({ ...rest, guide_type: guideType })
        .select("id")
        .single();
      if (error) throw error;
      catalogId = data.id;
    }
    const { error } = await supabase
      .from("implementation_guide_items")
      .insert({ ...input, implementation_id: implementationId, guide_type: guideType, catalog_item_id: catalogId });
    if (error) throw error;
  }
  await supabase.from("audit_logs").insert({
    event: id ? "guide.item_updated" : "guide.item_created",
    entity_type: "implementation",
    entity_id: implementationId,
    metadata: { name: input.name, guideType },
  });
}

export async function deleteGuideItem(id: string) {
  const { error } = await supabase.from("implementation_guide_items").delete().eq("id", id);
  if (error) throw error;
}

export async function quickMarkGuideItem(itemId: string, have: boolean) {
  const { error } = await supabase.rpc("admin_quick_mark_guide_item", { p_item_id: itemId, p_have: have });
  if (error) throw error;
}

export async function reviewResponse(input: {
  responseId: string;
  action: "confirm" | "correct" | "reject";
  quantity?: number;
  note?: string;
}) {
  const { error } = await supabase.rpc("admin_review_guide_response", { p_data: input as never });
  if (error) throw error;
}

export async function isGuideReleased(implementationId: string, guideType: GuideType = "utensilios"): Promise<boolean> {
  const { data, error } = await supabase
    .from("portal_visibility_releases")
    .select("id")
    .eq("implementation_id", implementationId)
    .eq("block", guideBlock[guideType])
    .is("revoked_at", null)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function setGuideReleased(implementationId: string, released: boolean, guideType: GuideType = "utensilios") {
  const { error } = released
    ? await supabase.rpc("admin_release_portal_block", {
        p_data: { implementationId, block: guideBlock[guideType], content: {} } as never,
      })
    : await supabase.rpc("admin_hide_portal_block", {
        p_implementation_id: implementationId,
        p_block: guideBlock[guideType],
      });
  if (error) throw error;
}

export async function uploadGuideImage(scope: "catalog" | "implementations", ownerId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${scope}/${ownerId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function removeGuideImage(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function signGuideImages(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, 3600);
  const out: Record<string, string> = {};
  (data ?? []).forEach((d, i) => {
    if (d.signedUrl) out[unique[i]!] = d.signedUrl;
  });
  return out;
}

export async function listCatalog(guideType: GuideType = "utensilios"): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from("guide_catalog_items")
    .select("*")
    .eq("guide_type", guideType)
    .order("category")
    .order("display_order");
  if (error) throw error;
  return (data ?? []) as unknown as CatalogItem[];
}

export async function saveCatalogItem(id: string | null, input: GuideItemInput & { active: boolean }, guideType: GuideType = "utensilios") {
  const { error } = id
    ? await supabase.from("guide_catalog_items").update(input).eq("id", id)
    : await supabase.from("guide_catalog_items").insert({ ...input, guide_type: guideType });
  if (error) throw error;
}
