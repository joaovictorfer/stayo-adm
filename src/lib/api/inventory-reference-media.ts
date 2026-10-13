import { supabase } from "@/integrations/supabase/client";
import { signGuideImages } from "./guides";
import { amenityDisplayKey } from "../inventory-amenities-view";
import { generatedInventoryImage } from "../inventory-generated-media";

export interface InventoryReferenceMedia {
  url?: string;
  description: string | null;
  tip: string | null;
  quantity_text: string | null;
}

export function inventoryReferenceFor(name: string, references?: Record<string, InventoryReferenceMedia>): InventoryReferenceMedia {
  const key = amenityDisplayKey(name);
  const referenceAliases: Record<string, string> = {
    souplast: "jogo_americano_ou_sousplat",
    sousplat: "jogo_americano_ou_sousplat",
  };
  const reference = references?.[key] ?? references?.[referenceAliases[key]];
  const url = reference?.url ?? generatedInventoryImage(name);
  return {
    description: reference?.description ?? null,
    tip: reference?.tip ?? null,
    quantity_text: reference?.quantity_text ?? null,
    ...(url ? { url } : {}),
  };
}

/** Read-only reference enrichment, independent of applying a snapshot or answering an item. */
export async function loadInventoryReferenceMedia(): Promise<Record<string, InventoryReferenceMedia>> {
  const { data, error } = await supabase.from("guide_catalog_items")
    .select("name,guide_type,image_path,description,tip,quantity_text")
    .eq("active", true).in("guide_type", ["utensilios", "inventario"]);
  if (error) throw error;
  const urls = await signGuideImages((data ?? []).flatMap((item) => item.image_path ? [item.image_path] : []));
  const out: Record<string, InventoryReferenceMedia> = {};
  // PDF utensil references take precedence over generic inventory references.
  for (const item of [...(data ?? [])].sort((a, b) => Number(a.guide_type === "utensilios") - Number(b.guide_type === "utensilios"))) {
    const url = item.image_path ? urls[item.image_path] : undefined;
    out[amenityDisplayKey(item.name)] = { ...(url ? { url } : {}), description: item.description, tip: item.tip, quantity_text: item.quantity_text };
  }
  return out;
}