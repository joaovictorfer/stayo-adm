import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, ImageIcon, List, MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { inventoryRooms } from "../../lib/guided-inventory";
import { getOwnerInventoryImagesByToken } from "../../lib/owner-guide.functions";
import { resolvePreparation, savePreparation, type PrepAnswer, type PrepItem } from "../../lib/api/owner-preparation";

const roomOrder = inventoryRooms.map((r) => r.key as string);
const roomLabel = (k: string) => inventoryRooms.find((r) => r.key === k)?.label ?? k;

export function usePreparation(token: string, enabled: boolean) {
  return useQuery({
    queryKey: ["owner-preparation", token],
    queryFn: () => resolvePreparation(token),
    enabled,
    retry: false,
  });
}

/** Etapa 5 · Preparação — mesmos itens do inventário da ficha; respostas viram propostas revisadas pela STAYO. */
export function PreparationStep({
  token,
  items: initial,
  onBack,
  onContinue,
}: {
  token: string;
  items: PrepItem[];
  onBack: () => void;
  onContinue: () => void;
}) {
  const qc = useQueryClient();
  const sorted = useMemo(
    () => [...initial].sort((a, b) => roomOrder.indexOf(a.room) - roomOrder.indexOf(b.room)),
    [initial],
  );
  const [answers, setAnswers] = useState<Record<string, { answer: PrepAnswer | null; note: string | null }>>(() =>
    Object.fromEntries(sorted.map((i) => [i.id, { answer: i.answer, note: i.note }])),
  );
  const [mode, setMode] = useState<"visual" | "lista">("visual");
  const [idx, setIdx] = useState(() => Math.max(0, sorted.findIndex((i) => !i.answer)));
  const [failed, setFailed] = useState<{ id: string; answer: PrepAnswer | null; note: string | null; advance: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [menuFor, setMenuFor] = useState<PrepItem | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const topRef = useRef<HTMLElement | null>(null);

  const fetchImages = useServerFn(getOwnerInventoryImagesByToken);
  const images = useQuery({
    queryKey: ["owner-preparation-images", token],
    queryFn: () => fetchImages({ data: { token } }),
    enabled: sorted.some((i) => i.hasImage),
    staleTime: 30 * 60_000,
  });

  const total = sorted.length;
  const answered = sorted.filter((i) => answers[i.id]?.answer).length;
  const remaining = total - answered;
  const allDone = total > 0 && remaining === 0;
  const item = sorted[Math.min(idx, total - 1)];

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
  }, []);

  const save = async (id: string, answer: PrepAnswer | null, note: string | null, advance: boolean) => {
    const prev = answers[id];
    setSaving(true);
    setFailed(null);
    setAnswers((a) => ({ ...a, [id]: { answer, note } }));
    try {
      await savePreparation(token, id, answer, note);
      void qc.invalidateQueries({ queryKey: ["owner-preparation", token] });
      if (advance && mode === "visual") {
        const pos = sorted.findIndex((i) => i.id === id);
        const nextOpen = sorted.findIndex((i, n) => n > pos && !answers[i.id]?.answer);
        setIdx(nextOpen >= 0 ? nextOpen : Math.min(pos + 1, total - 1));
      }
    } catch {
      setAnswers((a) => ({ ...a, [id]: prev ?? { answer: null, note: null } }));
      setFailed({ id, answer, note, advance });
    } finally {
      setSaving(false);
    }
  };

  const answerButtons = (it: PrepItem, compact = false) => {
    const cur = answers[it.id]?.answer;
    return (
      <div className={compact ? "pp-ans pp-ans--compact" : "pp-ans"}>
        {(["nao_tenho", "tenho"] as const).map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={cur === a}
            disabled={saving}
            className={`pp-ans-btn${cur === a ? " is-on" : ""}`}
            onClick={() => void save(it.id, a, answers[it.id]?.note ?? null, !compact)}
          >
            {a === "tenho" ? "Sim" : "Não"}
          </button>
        ))}
        <button type="button" className="pp-more" aria-label={`Mais opções para ${it.name}`} onClick={() => { setMenuFor(it); setNoteDraft(answers[it.id]?.note ?? ""); }}>
          <MoreHorizontal className="size-5" />
        </button>
      </div>
    );
  };

  const errorBox = failed && (
    <div className="pp-error" role="alert">
      <span>Não foi possível salvar.</span>
      <button type="button" onClick={() => void save(failed.id, failed.answer, failed.note, failed.advance)}>Tentar novamente</button>
    </div>
  );

  if (total === 0) {
    return (
      <section className="pd-step" ref={topRef}>
        <div className="pd-head">
          <h2 className="pd-title">Vamos preparar seu imóvel</h2>
          <p className="pd-lead">A equipe STAYO ainda está montando a lista de itens. Você pode seguir e voltar depois.</p>
        </div>
        <Actions onBack={onBack} onContinue={onContinue} />
      </section>
    );
  }

  return (
    <section className="pd-step" ref={topRef}>
      <div className="pd-head">
        <h2 className="pd-title">Vamos preparar seu imóvel</h2>
        <p className="pd-lead">
          {allDone ? "Todos os itens foram respondidos." : `Falta${remaining === 1 ? "" : "m"} ${remaining} ${remaining === 1 ? "item" : "itens"} para concluir esta etapa.`}
        </p>
      </div>
      <div>
        <p className="pp-count">{answered} de {total} respondidos</p>
        <div className="pp-bar"><span style={{ width: `${Math.round((answered / total) * 100)}%` }} /></div>
      </div>

      {allDone && mode === "visual" ? (
        <div className="pp-done">
          <span className="ac-badge" aria-hidden="true"><Check className="size-6" /></span>
          <strong>Preparação respondida</strong>
          <p>A STAYO confere suas respostas. Você pode revisar qualquer item pela lista.</p>
        </div>
      ) : null}

      <div className="pp-toggle" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "visual"} className={mode === "visual" ? "is-on" : ""} onClick={() => setMode("visual")}>
          <ImageIcon className="size-4" /> Visual
        </button>
        <button type="button" role="tab" aria-selected={mode === "lista"} className={mode === "lista" ? "is-on" : ""} onClick={() => setMode("lista")}>
          <List className="size-4" /> Lista rápida
        </button>
      </div>

      {errorBox}

      {mode === "visual" && item && !allDone && (
        <div className="pp-visual">
          <p className="pp-meta">{roomLabel(item.room)} · Item {sorted.indexOf(item) + 1} de {total}</p>
          <div className="pp-photo">
            {images.data?.[item.id] ? <img src={images.data[item.id]} alt={item.name} /> : <ImageIcon className="size-10" aria-hidden="true" />}
          </div>
          <h3 className="pp-name">{item.name}</h3>
          {(item.tip || item.description) && <p className="pd-lead">{item.tip || item.description}</p>}
          <p className="pp-q">Seu imóvel possui este item?</p>
          {answerButtons(item)}
          {answers[item.id]?.answer === "nao_aplica" && <p className="pd-hint">Marcado como "Não se aplica".</p>}
          <p className="pd-hint">Mais opções em ••• · N/A, observação{item.purchaseUrl ? " e onde comprar" : ""}</p>
          <div className="pp-nav">
            <button type="button" className="pd-back" disabled={idx <= 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>Anterior</button>
            <button type="button" className="pd-back" disabled={idx >= total - 1} onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}>Pular</button>
          </div>
        </div>
      )}

      {mode === "lista" && (
        <ul className="pp-list">
          {sorted.map((it) => (
            <li key={it.id} className="pp-row">
              <span className="pp-thumb">{images.data?.[it.id] ? <img src={images.data[it.id]} alt="" /> : <ImageIcon className="size-4" />}</span>
              <span className="pp-row-name">
                {it.name}
                {answers[it.id]?.answer === "nao_aplica" && <small>Não se aplica</small>}
              </span>
              {answerButtons(it, true)}
            </li>
          ))}
        </ul>
      )}

      <Actions onBack={onBack} onContinue={onContinue} />

      <Sheet open={Boolean(menuFor)} onOpenChange={(o) => !o && setMenuFor(null)}>
        <SheetContent side="bottom" className="pp-sheet">
          <SheetHeader><SheetTitle>{menuFor?.name}</SheetTitle></SheetHeader>
          {menuFor && (
            <div className="pp-sheet-body">
              <button type="button" className="pf-row" onClick={() => { void save(menuFor.id, "nao_aplica", answers[menuFor.id]?.note ?? null, true); setMenuFor(null); }}>
                Não se aplica ao meu imóvel (N/A)
              </button>
              <label className="portal-field-label" htmlFor="pp-note">Observação</label>
              <textarea id="pp-note" className="portal-input pp-note" maxLength={500} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
              <Button type="button" className="portal-cta pd-cta" onClick={() => { void save(menuFor.id, answers[menuFor.id]?.answer ?? null, noteDraft.trim() || null, false); setMenuFor(null); }}>
                Salvar observação
              </Button>
              {menuFor.purchaseUrl && (
                <a className="pd-back" href={menuFor.purchaseUrl} target="_blank" rel="noopener noreferrer">Onde comprar</a>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function Actions({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <div className="pd-actions">
      <Button type="button" className="portal-cta pd-cta" onClick={onContinue}>
        Continuar <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
      <button type="button" className="pd-back" onClick={onBack}>Voltar</button>
    </div>
  );
}
