import { ROOM_SECTIONS, type AmenitiesData, type CustomItem, type ItemDef, type ItemState, type RoomKind } from "./amenities";
import type { InventoryRoom } from "./guided-inventory";

/** Comodidades → inventário guiado. Chave estável por ambiente+item; idempotente. */
export interface SyncRow {
  amenity_key: string;
  room: InventoryRoom;
  name: string;
  on: boolean;
  qty: number | null;
  brand: string | null;
  notes: string | null;
  order: number;
}

const ROOM_MAP: Record<RoomKind, InventoryRoom> = {
  cozinha: "cozinha", sala: "sala", quarto: "quartos", banheiro: "banheiros", lavabo: "banheiros",
  servico: "lavanderia", externa: "externa", geral: "outros", outro: "outros",
};

const qtyOf = (s: ItemState) => {
  const o = s.opts ? Object.values(s.opts).reduce((a, b) => a + (b || 0), 0) : 0;
  return s.qty ?? (o > 0 ? o : null);
};
const notesOf = (s: ItemState, def?: ItemDef) => {
  const parts: string[] = [];
  if (s.opts) {
    const o = Object.entries(s.opts).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`);
    if (o.length) parts.push(o.join(", "));
  }
  if (def?.company && s.company?.trim()) parts.push(`Empresa: ${s.company.trim()}`);
  if ((s as CustomItem).supplier?.trim()) parts.push(`Fornecedor: ${(s as CustomItem).supplier!.trim()}`);
  if (s.notes?.trim()) parts.push(s.notes.trim());
  return parts.length ? parts.join(" · ") : null;
};

export function buildSyncRows(data: AmenitiesData): SyncRow[] {
  const out: SyncRow[] = [];
  let order = 1000;
  const push = (key: string, kind: RoomKind, label: string, name: string, s: ItemState | undefined, def?: ItemDef) => {
    out.push({
      amenity_key: key, room: ROOM_MAP[kind], name: `${label} · ${name}`, on: !!s?.on,
      qty: s ? qtyOf(s) : null, brand: s?.brand?.trim() || null, notes: s ? notesOf(s, def) : null, order: order++,
    });
  };
  const walk = (prefix: string, kind: RoomKind, label: string, items: Record<string, ItemState>, custom: CustomItem[], parentOn = true) => {
    for (const sec of ROOM_SECTIONS[kind]) for (const def of sec.items) {
      const s = items[def.key];
      if (!s && !parentOn) continue;
      if (s) push(`${prefix}:${def.key}`, kind, label, def.label, s, def);
      for (const sub of def.sub ?? []) {
        const ss = items[`${def.key}.${sub.key}`] ?? items[sub.key];
        if (ss) push(`${prefix}:${def.key}.${sub.key}`, kind, label, sub.label, { ...ss, on: !!ss.on && !!s?.on }, sub);
      }
    }
    for (const c of custom) if (c.name?.trim()) push(`${prefix}:c:${c.id}`, kind, label, c.name.trim(), c);
  };
  for (const r of data.rooms) {
    walk(`r:${r.id}`, r.kind, r.name, r.items ?? {}, r.custom ?? []);
    if (r.suite && r.bath) walk(`r:${r.id}:bath`, "banheiro", `Banheiro ${r.name}`, r.bath.items ?? {}, r.bath.custom ?? []);
  }
  return out;
}
