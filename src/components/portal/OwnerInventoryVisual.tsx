import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ExternalLink, ImageOff, MessageSquare, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { inventoryRooms, type InventoryAnswer } from "@/lib/guided-inventory";
import { getCurrentOwnerSession } from "@/lib/auth/owner-session";
import { getOwnerInventoryImages } from "@/lib/owner-inventory.functions";
import {
  ownerInventoryQuery,
  ownerSubmitInventory,
  type OwnerInventory,
  type OwnerInventoryItem,
  type OwnerProposal,
} from "@/lib/api/owner-inventory";

const roomOrder = inventoryRooms.map((r) => r.key as string);
const roomLabel = (k: string) => inventoryRooms.find((r) => r.key === k)?.label ?? k;

/**
 * Modo Visual: um item por vez (foto do catálogo → orientação → Não/Sim).
 * Lê e grava pelas mesmas RPCs do inventário; autosave silencioso, só falhas aparecem.
 */
export function OwnerInventoryVisual({
  implementationId,
  data,
  onBack,
  modeSwitch,
}: {
  implementationId: string;
  data: OwnerInventory;
  onBack: () => void;
  modeSwitch: React.ReactNode;
}) {
  const qc = useQueryClient();
  const key = ownerInventoryQuery(implementationId).queryKey;
  const items = useMemo(
    () => [...data.items].sort((a, b) => roomOrder.indexOf(a.room) - roomOrder.indexOf(b.room) || a.displayOrder - b.displayOrder),
    [data.items],
  );
  const subFor = (id: string) => data.submissions.find((s) => s.itemId === id);
  const currentOf = (i: OwnerInventoryItem): OwnerProposal => ({ ...(subFor(i.id)?.proposed ?? {}) });
  const answerOf = (i: OwnerInventoryItem) => local[i.id]?.answer ?? subFor(i.id)?.proposed.answer ?? i.answer ?? null;

  const [local, setLocal] = useState<Record<string, OwnerProposal>>({});
  const firstOpen = Math.max(0, items.findIndex((i) => !(subFor(i.id)?.proposed.answer ?? i.answer)));
  const [idx, setIdx] = useState(firstOpen);
  const [noteOpen, setNoteOpen] = useState(false);
  const [failed, setFailed] = useState<{ itemId: string; p: OwnerProposal; offline: boolean } | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const images = useQuery({
    queryKey: ["owner-inventory-images", implementationId],
    queryFn: async () => {
      const s = await getCurrentOwnerSession();
      if (!s) return {};
      return getOwnerInventoryImages({ data: { implementationId, accessToken: s.access_token } });
    },
    enabled: items.some((i) => i.hasImage),
    staleTime: 50 * 60 * 1000,
  });

  const save = useMutation({
    mutationFn: (v: { itemId: string; p: OwnerProposal }) => ownerSubmitInventory(implementationId, v.itemId, v.p),
    onSuccess: () => { setFailed(null); void qc.invalidateQueries({ queryKey: key }); },
    onError: (_e, v) => setFailed({ ...v, offline: typeof navigator !== "undefined" && !navigator.onLine }),
  });

  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);

  if (!items.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>Nenhum item no inventário ainda.</p>
        <button onClick={onBack} className="text-sm underline">Voltar</button>
      </div>
    );
  }

  const safeIdx = Math.min(idx, items.length - 1);
  const item = items[safeIdx]!;
  const inRoom = items.filter((i) => i.room === item.room);
  const posInRoom = inRoom.findIndex((i) => i.id === item.id) + 1;
  const answer = answerOf(item);
  const isLast = safeIdx === items.length - 1;
  const answeredCount = items.filter((i) => answerOf(i)).length;
  const done = answeredCount === items.length;

  function submit(p: OwnerProposal, advance: boolean) {
    const merged = { ...currentOf(item), ...(local[item.id] ?? {}), ...p };
    setLocal((l) => ({ ...l, [item.id]: merged }));
    save.mutate({ itemId: item.id, p: merged });
    if (advance && !noteOpen && !isLast) {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => setIdx((n) => Math.min(n + 1, items.length - 1)), 280);
    }
  }
  const choose = (a: InventoryAnswer) => submit({ answer: a }, true);
  const img = images.data?.[item.id];
  const guidance = item.tip ?? item.description;
  const note = local[item.id]?.note ?? currentOf(item).note ?? "";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col" style={{ background: "#faf8f4", color: "var(--stayo-forest)" }}>
      {/* Topo */}
      <header className="sticky top-0 z-10 px-4 pb-3 pt-3" style={{ background: "#faf8f4" }}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <button aria-label="Voltar" onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full"><ArrowLeft className="h-5 w-5" /></button>
          <p className="truncate text-center text-sm font-semibold" data-testid="visual-position">{roomLabel(item.room)} · {posInRoom} de {inRoom.length}</p>
          {modeSwitch}
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full" style={{ background: "var(--stayo-forest-soft)" }} aria-hidden>
          <div className="h-full rounded-full transition-all" style={{ width: `${(answeredCount / items.length) * 100}%`, background: "var(--stayo-success)" }} />
        </div>
      </header>

      {failed && (
        <div role="alert" className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--stayo-danger)", color: "var(--stayo-danger)", background: "#fff" }}>
          <span>{failed.offline ? "Sem conexão. Sua resposta não foi salva." : "Não foi possível salvar sua resposta."}</span>
          <button className="flex shrink-0 items-center gap-1 font-medium underline" onClick={() => save.mutate({ itemId: failed.itemId, p: failed.p })}><RotateCcw className="h-4 w-4" /> Tentar de novo</button>
        </div>
      )}

      <main className="flex flex-1 flex-col px-4 pb-6">
        {/* Foto de referência do catálogo */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl" style={{ background: "#efebe3" }}>
          {img ? (
            <img src={img} alt={`Referência: ${item.name}`} className="h-full w-full object-cover" data-testid="visual-photo" />
          ) : item.hasImage && images.isPending ? (
            <div className="h-full w-full animate-pulse" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ color: "#a59d8f" }} data-testid="visual-photo-fallback">
              <ImageOff className="h-8 w-8" />
              <span className="text-xs">Sem foto de referência</span>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-2">
          {item.recommended && (
            <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "#e7f1ea", color: "var(--stayo-success)" }}>Recomendado</span>
          )}
          <h1 className="text-2xl font-semibold leading-tight" style={{ fontFamily: "var(--stayo-font-display)" }}>{item.name}</h1>
          {guidance && <p className="line-clamp-2 text-[15px] leading-snug" style={{ color: "var(--stayo-ink-muted)" }}>{guidance}</p>}
        </div>

        <p className="mt-6 text-base font-medium">Você tem este item?</p>
        <div className="mt-3 grid grid-cols-2 gap-3" role="radiogroup" aria-label={`Você tem ${item.name}?`}>
          <button role="radio" aria-checked={answer === "nao_tenho"} onClick={() => choose("nao_tenho")}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 text-base font-semibold transition"
            style={answer === "nao_tenho"
              ? { borderColor: "var(--stayo-danger)", background: "#fbeeec", color: "var(--stayo-danger)" }
              : { borderColor: "#e3c9c5", background: "#fff", color: "var(--stayo-forest)" }}>
            <X className="h-5 w-5" style={{ color: "var(--stayo-danger)" }} /> Não
          </button>
          <button role="radio" aria-checked={answer === "tenho"} onClick={() => choose("tenho")}
            className="h-14 rounded-2xl text-base font-semibold transition"
            style={{ background: "var(--stayo-success)", color: "#fff", boxShadow: answer === "tenho" ? "0 0 0 3px #fff, 0 0 0 5px var(--stayo-success)" : undefined }}>
            Sim
          </button>
        </div>

        {/* Ações secundárias */}
        <div className="mt-4 flex items-center justify-center gap-1 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          <button onClick={() => choose("nao_aplica")} aria-pressed={answer === "nao_aplica"}
            className="rounded-full px-3 py-2" style={answer === "nao_aplica" ? { background: "var(--stayo-forest-soft)", color: "var(--stayo-forest)", fontWeight: 600 } : undefined}>N/A</button>
          <span aria-hidden>·</span>
          <button onClick={() => setNoteOpen(true)} className="flex items-center gap-1 rounded-full px-3 py-2">
            <MessageSquare className="h-4 w-4" /> Observação{note ? " •" : ""}
          </button>
          {item.purchaseUrl && (
            <>
              <span aria-hidden>·</span>
              <a href={item.purchaseUrl} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 rounded-full px-3 py-2" data-testid="visual-buy">
                Onde comprar <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between pt-6 text-sm">
          <button disabled={safeIdx === 0} onClick={() => setIdx(safeIdx - 1)} className="flex items-center gap-1 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /> Anterior</button>
          {isLast ? (
            <span style={{ color: "var(--stayo-ink-muted)" }}>{done ? "Inventário concluído" : "Último item"}</span>
          ) : posInRoom === inRoom.length ? (
            <button onClick={() => setIdx(safeIdx + 1)} style={{ color: "var(--stayo-ink-muted)" }}>Próximo: {roomLabel(items[safeIdx + 1]!.room)}</button>
          ) : (
            <button onClick={() => setIdx(safeIdx + 1)} style={{ color: "var(--stayo-ink-muted)" }}>Pular</button>
          )}
        </div>
      </main>

      <NoteSheet open={noteOpen} initial={note} itemName={item.name} onClose={() => setNoteOpen(false)}
        onSave={(t) => { submit({ note: t.trim() || undefined }, false); setNoteOpen(false); }} />
    </div>
  );
}

function NoteSheet({ open, initial, itemName, onClose, onSave }: { open: boolean; initial: string; itemName: string; onClose: () => void; onSave: (t: string) => void }) {
  const [text, setText] = useState(initial);
  useEffect(() => { if (open) setText(initial); }, [open, initial]);
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto max-w-[480px] rounded-t-3xl">
        <SheetHeader><SheetTitle className="text-base">Observação · {itemName}</SheetTitle></SheetHeader>
        <textarea autoFocus maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Opcional"
          aria-label="Observação" className="mt-3 min-h-24 w-full rounded-xl border p-3 text-sm" style={{ borderColor: "var(--stayo-border)" }} />
        <button onClick={() => onSave(text)} className="mt-3 h-12 w-full rounded-2xl text-sm font-semibold" style={{ background: "var(--stayo-forest)", color: "#fff" }}>Concluir</button>
      </SheetContent>
    </Sheet>
  );
}
