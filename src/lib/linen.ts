import { z } from "zod";
import type { AmenitiesData } from "./amenities";
export const linenItemSchema = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
  size: z.string(),
  color: z.string(),
  quantity: z.number(),
  unitCents: z.number(),
});
export const linenPayloadSchema = z.object({
  supplier: z.string(),
  number: z.string(),
  date: z.string(),
  delivery: z.string().nullable(),
  discountCents: z.number(),
  freightCents: z.number(),
  totalCents: z.number(),
  notes: z.string(),
  items: z.array(linenItemSchema),
});
export type LinenPayload = z.infer<typeof linenPayloadSchema>;
export const brl = (c: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function linenMatches(item: LinenPayload["items"][number], name: string, size: string) {
  const text = normalize(item.name + " " + item.category), wanted = normalize(name);
  const bed = normalize(size === "Auxiliar" ? "Solteiro" : size);
  const category = wanted === "lencol com elastico" ? /lencol/.test(text) && /elastico/.test(text)
    : wanted === "pillow top de unificacao" ? /uniao/.test(text) && /pillow/.test(text)
    : wanted === "lencol sem elastico" ? /lencol/.test(text) && !/elastico/.test(text)
    : wanted === "edredom" ? /edredom/.test(text) && !/capa|duvet/.test(text)
    : wanted === "capa de edredom" ? /duvet|capa.*edredom/.test(text)
    : wanted === "protetor de colchao" ? /protetor.*colchao/.test(text)
    : wanted === "protetor de travesseiro" ? /protetor.*travesseiro/.test(text)
    : wanted === "travesseiro" ? /travesseiro/.test(text) && !/protetor|capa/.test(text)
    : wanted === "fronha" ? /fronha/.test(text) : false;
  return category && (wanted === "pillow top de unificacao" || size.startsWith("0,50") || normalize(item.name).includes(bed));
}
export function linenDocumentDifferences(order: LinenPayload, quote: LinenPayload) {
  return order.items.flatMap((item, index) => {
    const before = quote.items[index];
    if (!before) return [`${item.name}: ausente no orçamento`];
    const changes: string[] = [];
    if (normalize(item.size).replace(/\s/g, "") !== normalize(before.size).replace(/\s/g, "")) changes.push(`medidas: ${before.size || "não informadas"} → ${item.size || "não informadas"}`);
    if (normalize(item.color) !== normalize(before.color)) changes.push(`cor: ${before.color || "não informada"} → ${item.color || "não informada"}`);
    if (item.quantity !== before.quantity) changes.push(`quantidade: ${before.quantity} → ${item.quantity}`);
    if (item.unitCents !== before.unitCents) changes.push(`unitário: ${brl(before.unitCents)} → ${brl(item.unitCents)}`);
    return changes.length ? [`${item.name}: ${changes.join("; ")}`] : [];
  });
}
export function validateLinen(p: LinenPayload) {
  if (
    !p.items.length ||
    p.items.some(
      (i) =>
        !i.name.trim() ||
        !Number.isInteger(i.quantity) ||
        i.quantity < 1 ||
        i.quantity > 999 ||
        !Number.isSafeInteger(i.unitCents) ||
        i.unitCents < 0,
    )
  )
    throw new Error("Revise nomes, quantidades e valores dos itens.");
  const sum = p.items.reduce((s, i) => s + i.quantity * i.unitCents, 0);
  for (const n of [p.discountCents, p.freightCents, p.totalCents])
    if (!Number.isSafeInteger(n) || n < 0) throw new Error("Valores inválidos.");
  if (sum - p.discountCents + p.freightCents !== p.totalCents)
    throw new Error("A soma dos itens, desconto e frete não fecha com o total.");
  return p;
}
export function allocateLinen(p: LinenPayload) {
  const gross = p.items.map((i) => i.quantity * i.unitCents),
    sum = gross.reduce((a, b) => a + b, 0);
  if (!sum) return gross;
  const raw = gross.map((v) => (v * p.totalCents) / sum),
    out = raw.map(Math.floor);
  let remainder = p.totalCents - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((n, i) => ({ i, f: n - Math.floor(n) }))
    .sort((a, b) => b.f - a.f || a.i - b.i);
  for (const x of order) {
    if (!remainder) break;
    out[x.i] = (out[x.i] ?? 0) + 1;
    remainder--;
  }
  return out;
}
export function linenNeeds(data: AmenitiesData) {
  const result: { key: string; room: string; name: string; size: string; required: number }[] = [];
  for (const room of data.rooms ?? []) {
    for (const [size, count] of Object.entries(room.items?.["camas"]?.opts ?? {})) {
      if (!count) continue;
      for (const name of [
        "Lençol com elástico",
        "Lençol sem elástico",
        "Edredom",
        "Capa de edredom",
        "Protetor de colchão",
      ])
        result.push({
          key: `${room.id}:${size}:${name}`,
          room: room.name,
          name,
          size,
          required: count * 2,
        });
    }
    if (room.items?.["unificacao_solteiros"]?.on && (room.items?.["camas"]?.opts?.["Solteiro"] ?? 0) >= 2) {
      result.push({ key: `${room.id}:unificacao:pillow`, room: room.name, name: "Pillow top de unificação", size: "1,76 × 1,88 — conforme pedido", required: Math.floor((room.items?.["camas"]?.opts?.["Solteiro"] ?? 0) / 2) });
    }
    const pillows = Object.values(room.items?.["travesseiros"]?.opts ?? {}).reduce(
      (a, b) => a + b,
      0,
    );
    if (pillows)
      for (const name of ["Travesseiro", "Fronha", "Protetor de travesseiro"])
        result.push({
          key: `${room.id}:travesseiro:${name}`,
          room: room.name,
          name,
          size: "0,50 × 0,70 — conferir",
          required: pillows * 2,
        });
  }
  return result;
}
