import { CameraOff, ChevronLeft, CloudOff, ImageIcon, Loader2, RotateCcw, SkipForward, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { addAudit, burnEvidence, getQueued, putQueued, queueKey, uploadEvidence, type EvidenceContext, type EvidenceMeta } from "@/lib/vistoria/evidence";

export type RunContext = Omit<EvidenceContext, "room" | "itemId" | "itemName">;

/**
 * Execução por câmera do link externo de vistoria — PROTÓTIPO VISUAL.
 * Não existe backend de evidências ainda: a foto capturada fica só na
 * fila do aparelho como "Pendente de envio", nunca como salva.
 */
export interface RunItem {
  id: string;
  room: string;
  name: string;
  ref: {
    photo?: string;
    description?: string;
    quantity?: number;
    brand?: string;
    condition?: string;
    note?: string;
  };
}

type CamState = "pedindo" | "ativa" | "negada" | "indisponivel";
type Status = "pendente" | "pulado" | "pendente_envio";

export function CameraRun({ items, context, onExit }: { items: RunItem[]; context: RunContext; onExit: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cam, setCam] = useState<CamState>("pedindo");
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [shots, setShots] = useState<Record<string, string>>({});
  const [online, setOnline] = useState(true);
  const [refOpen, setRefOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const [draft, setDraft] = useState<{ blob: Blob; meta: EvidenceMeta; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Retomada: fotos que ficaram na fila do aparelho voltam como "Pendente de envio".
  useEffect(() => {
    getQueued(context.inspectionId).then((q) => {
      setStatus((s) => ({ ...s, ...Object.fromEntries(q.map((e) => [e.itemId, "pendente_envio" as const])) }));
      setShots((s) => ({ ...s, ...Object.fromEntries(q.map((e) => [e.itemId, URL.createObjectURL(e.blob)])) }));
    }).catch(() => setNotice("Não foi possível ler as fotos guardadas neste aparelho."));
  }, [context.inspectionId]);

  const start = useCallback(async () => {
    setCam("pedindo");
    if (!navigator.mediaDevices?.getUserMedia) return setCam("indisponivel");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
      setCam("ativa");
    } catch (e) {
      const n = (e as DOMException)?.name;
      setCam(n === "NotAllowedError" || n === "SecurityError" ? "negada" : "indisponivel");
    }
  }, []);

  useEffect(() => {
    void start();
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [start]);

  const item = items[idx]!;
  const total = items.length;
  const cur = status[item.id] ?? "pendente";
  const pendingUploads = Object.values(status).filter((s) => s === "pendente_envio").length;

  const next = () => { setRefOpen(false); setIdx((i) => Math.min(total - 1, i + 1)); };

  const capture = async () => {
    const v = videoRef.current;
    if (!v || cam !== "ativa" || !v.videoWidth || busy) return;
    setBusy(true);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    try {
      const { blob, meta } = await burnEvidence(v, { ...context, room: item.room, itemId: item.id, itemName: item.name });
      setDraft({ blob, meta, url: URL.createObjectURL(blob) });
    } catch {
      setNotice("Não foi possível gerar a foto. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const retake = async () => {
    if (!draft) return;
    await addAudit({ at: new Date().toISOString(), action: "descartada_retirar", itemId: item.id, inspectionId: context.inspectionId, author: context.author, sha256: draft.meta.sha256 }).catch(() => undefined);
    URL.revokeObjectURL(draft.url);
    setDraft(null);
  };

  const useDraft = async () => {
    if (!draft) return;
    setBusy(true);
    const now = new Date().toISOString();
    const base = { itemId: item.id, inspectionId: context.inspectionId, author: context.author, sha256: draft.meta.sha256 };
    try {
      if (status[item.id] === "pendente_envio") await addAudit({ ...base, at: now, action: "substituida" });
      await addAudit({ ...base, at: now, action: "capturada", detail: draft.meta.capturedAt });
      await uploadEvidence(draft.blob, draft.meta);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha no envio";
      try {
        await putQueued({ key: queueKey(context.inspectionId, item.id), itemId: item.id, blob: draft.blob, meta: draft.meta, status: "pendente_envio", queuedAt: now, lastError: msg });
        await addAudit({ ...base, at: now, action: "envio_falhou", detail: msg });
        setStatus((s) => ({ ...s, [item.id]: "pendente_envio" }));
        setShots((s) => ({ ...s, [item.id]: draft.url }));
        setDraft(null);
        setBusy(false);
        setNotice("Foto guardada neste aparelho · Pendente de envio. O item não foi concluído.");
        window.setTimeout(next, 600);
        return;
      } catch {
        setNotice("Não foi possível guardar a foto neste aparelho. Tente de novo.");
      }
    }
    setBusy(false);
  };

  const skip = () => {
    if (cur !== "pendente_envio") setStatus((s) => ({ ...s, [item.id]: "pulado" }));
    next();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[oklch(0.16_0.03_250)] text-[oklch(0.98_0_0)]" role="dialog" aria-label="Execução da vistoria">
      <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 h-full w-full object-cover ${cam === "ativa" ? "" : "hidden"}`} />
      {flash && <div className="pointer-events-none absolute inset-0 bg-[oklch(1_0_0)] opacity-70" />}

      {/* Topo */}
      <header className="relative z-10 bg-[oklch(0.16_0.03_250/0.78)] px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={onExit} aria-label="Sair da câmera" className="-ml-2 grid size-10 place-items-center rounded-full">
            <ChevronLeft className="size-6" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold">{item.room} · {item.name}</h1>
          </div>
          <span className="shrink-0 text-sm tabular-nums opacity-85">{idx + 1} de {total}</span>
        </div>
        <div className="mt-3 h-1 rounded-full bg-[oklch(1_0_0/0.18)]">
          <div className="h-1 rounded-full bg-[oklch(0.8_0.13_185)] transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {cur === "pulado" && <Chip>Pulado · continua pendente</Chip>}
          {cur === "pendente_envio" && <Chip warn><CloudOff className="size-3.5" /> Pendente de envio · item não concluído</Chip>}
          {notice && <Chip>{notice}</Chip>}
          {!online && <Chip warn><WifiOff className="size-3.5" /> Conexão instável — nada foi enviado</Chip>}
          {pendingUploads > 0 && online && (
            <Chip warn><CloudOff className="size-3.5" /> {pendingUploads} {pendingUploads === 1 ? "foto pendente de envio" : "fotos pendentes de envio"}</Chip>
          )}
        </div>
      </header>

      {/* Centro */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-6">
        {cam === "pedindo" && (
          <div className="text-center"><Loader2 className="mx-auto size-8 animate-spin" /><p className="mt-3 text-sm opacity-85">Pedindo acesso à câmera…</p></div>
        )}
        {cam === "negada" && (
          <Problem title="Câmera bloqueada" text="Permita o acesso à câmera nas configurações do navegador e tente de novo. Nenhuma foto foi registrada." onRetry={start} />
        )}
        {cam === "indisponivel" && (
          <Problem title="Câmera indisponível" text="Não encontramos uma câmera neste aparelho ou ela está em uso por outro app. Nenhuma foto foi registrada." onRetry={start} />
        )}
        {cam === "ativa" && shots[item.id] && cur === "pendente_envio" && (
          <img src={shots[item.id]} alt="" className="absolute bottom-4 right-4 size-16 rounded-lg border-2 border-[oklch(1_0_0)] object-cover" />
        )}
      </div>

      {/* Rodapé */}
      <footer className="relative z-10 bg-[oklch(0.16_0.03_250/0.78)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <button onClick={skip} className="flex h-12 min-w-24 items-center gap-1.5 rounded-full px-3 text-sm">
            <SkipForward className="size-4" /> Pular por enquanto
          </button>
          <button
            onClick={capture}
            disabled={cam !== "ativa"}
            aria-label="Capturar foto"
            className="grid size-20 place-items-center rounded-full border-4 border-[oklch(1_0_0)] disabled:opacity-40"
          >
            <span className="size-16 rounded-full bg-[oklch(1_0_0)]" />
          </button>
          <button onClick={() => setRefOpen(true)} className="h-12 min-w-24 rounded-full border border-[oklch(0.8_0.13_185)] px-4 text-sm">
            Ver referência
          </button>
        </div>
      </footer>

      {draft && (
        <div className="absolute inset-0 z-30 flex flex-col bg-background text-foreground" role="dialog" aria-label="Foto capturada">
          <header className="flex items-center justify-between bg-[oklch(0.16_0.03_250)] px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-[oklch(0.98_0_0)]">
            <h2 className="text-xl font-semibold">Foto capturada</h2>
            <span className="text-sm tabular-nums opacity-80">{idx + 1}/{total}</span>
          </header>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <img src={draft.url} alt={`Foto de ${item.name} com identificação gravada`} className="max-h-full w-full rounded-2xl object-contain" />
          </div>
          <div className="space-y-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <button onClick={useDraft} disabled={busy} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60">
              {busy && <Loader2 className="size-4 animate-spin" />} Usar esta foto
            </button>
            <button onClick={retake} disabled={busy} className="h-14 w-full rounded-2xl border border-primary text-base font-semibold text-primary">Tirar outra foto</button>
          </div>
        </div>
      )}

      {refOpen && <ReferenceDrawer item={item} onClose={() => setRefOpen(false)} />}
    </div>
  );
}

function Chip({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${warn ? "bg-[oklch(0.75_0.15_70/0.25)]" : "bg-[oklch(1_0_0/0.15)]"}`}>{children}</span>
  );
}

function Problem({ title, text, onRetry }: { title: string; text: string; onRetry: () => void }) {
  return (
    <div className="max-w-xs text-center">
      <CameraOff className="mx-auto size-10" />
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm opacity-85">{text}</p>
      <button onClick={onRetry} className="mx-auto mt-5 flex h-11 items-center gap-2 rounded-full bg-[oklch(1_0_0)] px-5 text-sm font-semibold text-[oklch(0.16_0.03_250)]">
        <RotateCcw className="size-4" /> Tentar de novo
      </button>
    </div>
  );
}

function ReferenceDrawer({ item, onClose }: { item: RunItem; onClose: () => void }) {
  const r = item.ref;
  const rows: [string, string | undefined][] = [
    ["Quantidade", r.quantity != null ? String(r.quantity) : undefined],
    ["Marca", r.brand],
    ["Estado", r.condition],
    ["Observação", r.note],
  ];
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-[oklch(0_0_0/0.45)]" onClick={onClose}>
      <section
        onClick={(e) => e.stopPropagation()}
        className="max-h-[78dvh] overflow-y-auto rounded-t-3xl bg-background p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-foreground"
        aria-label="Referência do item"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Referência da implantação</p>
            <h2 className="text-lg font-semibold">{item.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar referência" className="grid size-10 place-items-center rounded-full bg-muted"><X className="size-5" /></button>
        </div>
        {r.photo ? (
          <img src={r.photo} alt={`Referência: ${item.name}`} className="mt-4 aspect-[4/3] w-full rounded-2xl object-cover" />
        ) : (
          <div className="mt-4 grid aspect-[4/3] place-items-center rounded-2xl bg-muted text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><ImageIcon className="size-4" /> Sem foto de referência</span>
          </div>
        )}
        <p className="mt-4 text-sm">{r.description ?? <span className="text-muted-foreground">Sem descrição.</span>}</p>
        <dl className="mt-4 divide-y divide-border rounded-2xl border border-border">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className={`text-right ${v ? "" : "text-muted-foreground"}`}>{v ?? "Não informado"}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
