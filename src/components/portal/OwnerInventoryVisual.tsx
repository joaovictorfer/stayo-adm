import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, Ban, Check, ExternalLink, FileText, ImageIcon, ImageOff, List,
  MoreHorizontal, RotateCcw, ShoppingCart, Star, UserRound, X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { StayoLogo } from "@/components/brand/StayoLogo";
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
const BG = "#faf8f4";
const muted = { color: "var(--stayo-ink-muted)" };

/**
 * Inventário do proprietário: Modo Visual (um item por vez) e Modo Lista
 * editam exatamente os mesmos registros, com estado local compartilhado.
 * Autosave silencioso — só falhas aparecem.
 */
export function OwnerInventoryVisual({
  implementationId,
  data,
  onBack,
}: {
  implementationId: string;
  data: OwnerInventory;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const key = ownerInventoryQuery(implementationId).queryKey;
  const items = useMemo(
    () => [...data.items].sort((a, b) => roomOrder.indexOf(a.room) - roomOrder.indexOf(b.room) || a.displayOrder - b.displayOrder),
    [data.items],
  );
  const subFor = (id: string) => data.submissions.find((s) => s.itemId === id);
  const [local, setLocal] = useState<Record<string, OwnerProposal>>({});
  const proposalOf = (i: OwnerInventoryItem): OwnerProposal => ({ ...(subFor(i.id)?.proposed ?? {}), ...(local[i.id] ?? {}) });
  const answerOf = (i: OwnerInventoryItem) => local[i.id]?.answer ?? subFor(i.id)?.proposed.answer ?? i.answer ?? null;

  const firstOpen = Math.max(0, items.findIndex((i) => !(subFor(i.id)?.proposed.answer ?? i.answer)));
  const [idx, setIdx] = useState(firstOpen);
  const [mode, setMode] = useState<"visual" | "lista">("visual");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ itemId: string; p: OwnerProposal; offline: boolean } | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listScroll = useRef(0);

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
  useLayoutEffect(() => { if (mode === "lista") window.scrollTo(0, listScroll.current); else window.scrollTo(0, 0); }, [mode]);

  if (!items.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm" style={muted}>Nenhum item no inventário ainda.</p>
        <button onClick={onBack} className="text-sm underline">Voltar</button>
      </div>
    );
  }

  const safeIdx = Math.min(idx, items.length - 1);
  const item = items[safeIdx]!;
  const inRoom = items.filter((i) => i.room === item.room);
  const posInRoom = inRoom.findIndex((i) => i.id === item.id) + 1;
  const answeredInRoom = inRoom.filter((i) => answerOf(i)).length;
  const roomsPresent = roomOrder.filter((r) => items.some((i) => i.room === r));
  const nextRoom = roomsPresent[roomsPresent.indexOf(item.room) + 1];

  function submitFor(target: OwnerInventoryItem, p: OwnerProposal, advance = false) {
    const merged = { ...proposalOf(target), ...p };
    setLocal((l) => ({ ...l, [target.id]: merged }));
    save.mutate({ itemId: target.id, p: merged });
    if (advance && safeIdx < items.length - 1) {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => setIdx((n) => Math.min(n + 1, items.length - 1)), 280);
    }
  }
  const goToRoom = (r: string) => setIdx(items.findIndex((i) => i.room === r));
  const openInVisual = (i: OwnerInventoryItem) => { listScroll.current = window.scrollY; setIdx(items.indexOf(i)); setMode("visual"); };
  const switchMode = (m: "visual" | "lista") => { if (m === "visual") listScroll.current = window.scrollY; setMode(m); };

  const noteItem = items.find((i) => i.id === noteFor);
  const menuItem = items.find((i) => i.id === menuFor);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col" style={{ background: BG, color: "var(--stayo-forest)" }}>
      <header className="sticky top-0 z-10 px-4 pb-3 pt-3" style={{ background: BG }}>
        <div className="flex items-center justify-between">
          <StayoLogo className="h-6" />
          <span className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--stayo-border)" }} aria-label="Perfil">
            <UserRound className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button aria-label="Voltar" onClick={onBack} className="-ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-full"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" data-testid="visual-position">
              {roomLabel(item.room)} · {mode === "visual" ? `${posInRoom} de ${inRoom.length}` : `${answeredInRoom} de ${inRoom.length}`}
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: "var(--stayo-forest-soft)" }} aria-hidden>
              <div className="h-full rounded-full transition-all" style={{ width: `${(answeredInRoom / inRoom.length) * 100}%`, background: "var(--stayo-success)" }} />
            </div>
          </div>
          <div className="flex shrink-0 rounded-full border p-0.5 text-xs" style={{ borderColor: "var(--stayo-border)", background: "#fff" }} role="tablist" aria-label="Modo de exibição">
            {(["visual", "lista"] as const).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
                className="flex items-center gap-1 rounded-full px-2.5 py-1.5 font-medium"
                style={mode === m ? { background: "var(--stayo-forest)", color: "#fff" } : undefined}>
                {m === "visual" ? <ImageIcon className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                {m === "visual" ? "Visual" : "Lista"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {failed && (
        <div role="alert" className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--stayo-danger)", color: "var(--stayo-danger)", background: "#fff" }}>
          <span>{failed.offline ? "Sem conexão. Sua resposta não foi salva." : "Não foi possível salvar sua resposta."}</span>
          <button className="flex shrink-0 items-center gap-1 font-medium underline" onClick={() => save.mutate({ itemId: failed.itemId, p: failed.p })}><RotateCcw className="h-4 w-4" /> Tentar de novo</button>
        </div>
      )}

      {mode === "visual" ? (
        <main className="flex flex-1 flex-col px-4 pb-4">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl" style={{ background: "#efebe3" }}>
            {images.data?.[item.id] ? (
              <img src={images.data[item.id]} alt={`Referência: ${item.name}`} className="h-full w-full object-cover" data-testid="visual-photo" />
            ) : item.hasImage && images.isPending ? (
              <div className="h-full w-full animate-pulse" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ color: "#a59d8f" }} data-testid="visual-photo-fallback">
                <ImageOff className="h-8 w-8" /><span className="text-xs">Sem foto de referência</span>
              </div>
            )}
          </div>

          <div className="mt-5 space-y-2">
            {item.recommended && (
              <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--stayo-success)" }}>
                <Star className="h-3.5 w-3.5 fill-current" /> Recomendado
              </span>
            )}
            <h1 className="text-2xl font-semibold leading-tight" style={{ fontFamily: "var(--stayo-font-display)" }}>{item.name}</h1>
            {(item.tip ?? item.description) && <p className="line-clamp-2 text-[15px] leading-snug" style={muted}>{item.tip ?? item.description}</p>}
          </div>

          <p className="mt-6 text-base font-medium">Você tem este item?</p>
          <AnswerButtons answer={answerOf(item)} name={item.name} size="lg" onChoose={(a) => submitFor(item, { answer: a }, true)} />

          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <Pill active={answerOf(item) === "nao_aplica"} onClick={() => submitFor(item, { answer: "nao_aplica" }, true)}><Ban className="h-4 w-4" /> N/A</Pill>
            <Pill active={Boolean(proposalOf(item).note)} onClick={() => setNoteFor(item.id)}><FileText className="h-4 w-4" /> Observação</Pill>
            {item.purchaseUrl ? (
              <a href={item.purchaseUrl} target="_blank" rel="noopener noreferrer nofollow" data-testid="visual-buy"
                className="flex h-10 items-center justify-center gap-1 rounded-full border bg-white font-medium" style={{ borderColor: "var(--stayo-border)" }}>
                <ShoppingCart className="h-4 w-4" /> Onde comprar <ExternalLink className="h-3 w-3" />
              </a>
            ) : <span />}
          </div>

          <div className="mt-auto flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--stayo-border)" }}>
            <button aria-label="Item anterior" disabled={safeIdx === 0} onClick={() => setIdx(safeIdx - 1)} className="grid h-10 w-10 place-items-center rounded-full disabled:opacity-30">
              <ArrowLeft className="h-5 w-5" />
            </button>
            {safeIdx < items.length - 1 && (
              <button onClick={() => setIdx(safeIdx + 1)} className="text-sm" style={muted}>
                {posInRoom === inRoom.length ? `Próximo: ${roomLabel(items[safeIdx + 1]!.room)}` : "Pular"}
              </button>
            )}
          </div>
        </main>
      ) : (
        <main className="flex flex-1 flex-col pb-4">
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {inRoom.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-2.5" data-testid="list-row">
                <button onClick={() => openInVisual(i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl" style={{ background: "#efebe3" }}>
                    {images.data?.[i.id] ? <img src={images.data[i.id]} alt="" className="h-full w-full object-cover" />
                      : <span className="grid h-full w-full place-items-center" style={{ color: "#a59d8f" }}><ImageOff className="h-4 w-4" /></span>}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{i.name}</span>
                    {answerOf(i) === "nao_aplica" && <span className="text-[11px]" style={muted}>N/A</span>}
                  </span>
                </button>
                <AnswerButtons answer={answerOf(i)} name={i.name} size="sm" onChoose={(a) => submitFor(i, { answer: a })} />
                <button aria-label={`Mais opções: ${i.name}`} onClick={() => setMenuFor(i.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-2 border-t px-4 py-3 text-sm" style={{ borderColor: "var(--stayo-border)", background: BG }}>
            <button onClick={onBack} className="font-medium" style={muted}>Salvar e continuar depois</button>
            {nextRoom && (
              <button onClick={() => { goToRoom(nextRoom); window.scrollTo(0, 0); }} className="flex items-center gap-1 font-semibold">
                Próximo ambiente: {roomLabel(nextRoom)} <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </main>
      )}

      <Sheet open={Boolean(menuItem)} onOpenChange={(o) => { if (!o) setMenuFor(null); }}>
        <SheetContent side="bottom" className="mx-auto max-w-[480px] rounded-t-3xl">
          <SheetHeader><SheetTitle className="text-base">{menuItem?.name}</SheetTitle></SheetHeader>
          {menuItem && (
            <div className="mt-2 grid gap-1 text-sm">
              <button className="flex h-12 items-center gap-3 rounded-xl px-2 text-left" onClick={() => { submitFor(menuItem, { answer: "nao_aplica" }); setMenuFor(null); }}><Ban className="h-4 w-4" /> N/A</button>
              <button className="flex h-12 items-center gap-3 rounded-xl px-2 text-left" onClick={() => { setNoteFor(menuItem.id); setMenuFor(null); }}><FileText className="h-4 w-4" /> Observação</button>
              {menuItem.purchaseUrl && (
                <a href={menuItem.purchaseUrl} target="_blank" rel="noopener noreferrer nofollow" className="flex h-12 items-center gap-3 rounded-xl px-2"><ShoppingCart className="h-4 w-4" /> Onde comprar <ExternalLink className="h-3 w-3" /></a>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <NoteSheet open={Boolean(noteItem)} initial={noteItem ? proposalOf(noteItem).note ?? "" : ""} itemName={noteItem?.name ?? ""}
        onClose={() => setNoteFor(null)}
        onSave={(t) => { if (noteItem) submitFor(noteItem, { note: t.trim() || undefined }); setNoteFor(null); }} />
    </div>
  );
}

function AnswerButtons({ answer, name, size, onChoose }: { answer: InventoryAnswer | null; name: string; size: "lg" | "sm"; onChoose: (a: InventoryAnswer) => void }) {
  const lg = size === "lg";
  const base = lg ? "h-14 rounded-2xl text-base gap-2" : "h-9 rounded-full px-3 text-xs gap-1";
  const icon = lg ? "h-5 w-5" : "h-3.5 w-3.5";
  const noOn = answer === "nao_tenho", yesOn = answer === "tenho";
  return (
    <div className={lg ? "mt-3 grid grid-cols-2 gap-3" : "flex shrink-0 gap-1.5"} role="radiogroup" aria-label={`Você tem ${name}?`}>
      <button role="radio" aria-checked={noOn} onClick={() => onChoose("nao_tenho")}
        className={`flex items-center justify-center border-2 font-semibold transition ${base}`}
        style={noOn ? { borderColor: "var(--stayo-danger)", background: "#fbeeec", color: "var(--stayo-danger)" }
          : { borderColor: lg ? "#e3c9c5" : "var(--stayo-border)", background: "#fff", color: "var(--stayo-forest)" }}>
        <X className={icon} style={{ color: "var(--stayo-danger)" }} /> Não
      </button>
      <button role="radio" aria-checked={yesOn} onClick={() => onChoose("tenho")}
        className={`flex items-center justify-center border-2 font-semibold transition ${base}`}
        style={lg || yesOn
          ? { background: "var(--stayo-forest)", borderColor: "var(--stayo-forest)", color: "#fff", boxShadow: lg && yesOn ? "0 0 0 3px #fff, 0 0 0 5px var(--stayo-success)" : undefined }
          : { borderColor: "var(--stayo-border)", background: "#fff", color: "var(--stayo-forest)" }}>
        <Check className={icon} style={!lg && !yesOn ? { color: "var(--stayo-success)" } : undefined} /> Sim
      </button>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className="flex h-10 items-center justify-center gap-1 rounded-full border font-medium"
      style={active ? { background: "var(--stayo-forest-soft)", borderColor: "var(--stayo-forest)" } : { background: "#fff", borderColor: "var(--stayo-border)" }}>
      {children}
    </button>
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
