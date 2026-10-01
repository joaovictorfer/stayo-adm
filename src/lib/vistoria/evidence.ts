import logoWhite from "@/assets/stayo-logo-white.png.asset.json";

/**
 * Evidência de vistoria por link externo.
 * - A identificação é GRAVADA nos pixels da imagem (canvas → JPEG), não é
 *   overlay de tela.
 * - Os metadados (autoria, horário, item, ambiente, ID da vistoria) e o
 *   sha256 da imagem final viajam junto da foto.
 * - Enquanto não existir o envio no servidor, a foto fica na fila do
 *   aparelho como "Pendente de envio" — nunca como salva.
 */

export interface EvidenceContext {
  inspectionId: string;
  inspectionKind: string; // ex. "Pré-check-in"
  inspectionStatus: string; // ex. "Em andamento"
  property: string;
  room: string;
  itemId: string;
  itemName: string;
  author: string; // vistoriador do link
  guest?: { firstName: string; lastName?: string };
}

export interface EvidenceMeta extends Omit<EvidenceContext, "guest"> {
  guestLabel?: string | undefined;
  capturedAt: string;
  sha256: string;
}

export function guestLabel(kind: string, g?: EvidenceContext["guest"]): string | undefined {
  if (!g || !/pr[ée]-check-in|p[óo]s-check-out/i.test(kind)) return undefined;
  const first = g.firstName.trim().split(/\s+/)[0] ?? "";
  const initial = g.lastName?.trim()[0];
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

async function sha256(blob: Blob): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const fmt = (d: Date) =>
  d.toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(".", "");

/** Desenha o quadro do vídeo e grava a identificação no canto inferior esquerdo. */
export async function burnEvidence(video: HTMLVideoElement, ctx: EvidenceContext): Promise<{ blob: Blob; meta: EvidenceMeta }> {
  const w = video.videoWidth, h = video.videoHeight;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.drawImage(video, 0, 0, w, h);

  const captured = new Date();
  const guest = guestLabel(ctx.inspectionKind, ctx.guest);
  const lines = [
    `${ctx.property} · ${ctx.room}`,
    ctx.itemName,
    `${ctx.inspectionKind} · ${ctx.inspectionStatus}`,
    ...(guest ? [`Hóspede: ${guest}`] : []),
    `${fmt(captured)} · ${ctx.inspectionId}`,
  ];
  const u = Math.max(12, Math.round(Math.min(w, h) / 34));
  const pad = u, lh = Math.round(u * 1.35), logoH = Math.round(u * 1.6);
  g.font = `600 ${u}px system-ui, sans-serif`;
  const textW = Math.max(...lines.map((l) => g.measureText(l).width));
  let logo: HTMLImageElement | null = null;
  try { logo = await loadImage(logoWhite.url); } catch { logo = null; }
  const logoW = logo ? (logo.width / logo.height) * logoH : g.measureText("STAYO").width;
  const boxW = Math.max(textW, logoW) + pad * 2;
  const boxH = pad * 2 + logoH + u * 0.5 + lines.length * lh;
  const x = pad, y = h - boxH - pad;
  g.fillStyle = "rgba(10,20,35,0.62)";
  g.beginPath(); g.roundRect(x, y, boxW, boxH, u * 0.6); g.fill();
  g.fillStyle = "#fff";
  if (logo) g.drawImage(logo, x + pad, y + pad, logoW, logoH);
  else { g.font = `700 ${logoH}px system-ui`; g.fillText("STAYO", x + pad, y + pad + logoH * 0.85); g.font = `600 ${u}px system-ui, sans-serif`; }
  lines.forEach((l, i) => g.fillText(l, x + pad, y + pad + logoH + u * 0.5 + (i + 1) * lh - u * 0.3));

  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao gerar a imagem"))), "image/jpeg", 0.85));
  const { guest: _g, ...rest } = ctx;
  return { blob, meta: { ...rest, guestLabel: guest, capturedAt: captured.toISOString(), sha256: await sha256(blob) } };
}

/** Envio ao servidor — ainda não existe destino seguro (bucket privado + token do link). */
export async function uploadEvidence(_blob: Blob, _meta: EvidenceMeta): Promise<never> {
  throw new Error("Envio de evidências ainda não disponível");
}

/* ---------- Fila do aparelho (IndexedDB) e trilha de auditoria ---------- */
export type QueueStatus = "pendente_envio";
export interface QueuedEvidence { key: string; itemId: string; blob: Blob; meta: EvidenceMeta; status: QueueStatus; queuedAt: string; lastError?: string }
export interface AuditEntry { at: string; action: "capturada" | "descartada_retirar" | "substituida" | "envio_falhou"; itemId: string; inspectionId: string; author: string; sha256?: string; detail?: string }

const DB = "stayo-vistoria-outbox";
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("evidence", { keyPath: "key" });
      r.result.createObjectStore("audit", { autoIncrement: true });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const r = fn(d.transaction(store, mode).objectStore(store));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export const queueKey = (inspectionId: string, itemId: string) => `${inspectionId}:${itemId}`;
export const putQueued = (e: QueuedEvidence) => tx("evidence", "readwrite", (s) => s.put(e));
export const getQueued = (inspectionId: string) =>
  tx<QueuedEvidence[]>("evidence", "readonly", (s) => s.getAll() as IDBRequest<QueuedEvidence[]>).then((all) =>
    all.filter((e) => e.meta.inspectionId === inspectionId),
  );
export const addAudit = (a: AuditEntry) => tx("audit", "readwrite", (s) => s.add(a));
export const getAudit = (inspectionId: string) =>
  tx<AuditEntry[]>("audit", "readonly", (s) => s.getAll() as IDBRequest<AuditEntry[]>).then((all) => all.filter((a) => a.inspectionId === inspectionId));
