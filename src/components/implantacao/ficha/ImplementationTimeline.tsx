import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleDashed, GripVertical, MessageSquare, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";

import { DEFAULT_TIMELINE_STEPS } from '@/lib/property-timeline';
export { DEFAULT_TIMELINE_STEPS } from '@/lib/property-timeline';

type Status = "pendente" | "parcial" | "concluido";
type Step = { id: string; title: string; position: number; done_at: string | null; status: Status; notes: string | null };

const TABLE = "implementation_timeline_steps";
const STATUS_OPTS: Array<{ v: Status; label: string }> = [
  { v: "pendente", label: "Pendente" },
  { v: "parcial", label: "Parcial" },
  { v: "concluido", label: "Concluído" },
];
const PARTIAL = "#b7791f";

export function ImplementationTimeline({ implementationId }: { implementationId: string }) {
  const qc = useQueryClient();
  const key = ["implementation-timeline", implementationId];
  const seeded = useRef(false);
  const [newTitle, setNewTitle] = useState("");
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [insertTitle, setInsertTitle] = useState("");
  const [openNotes, setOpenNotes] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("id,title,position,done_at,status,notes")
        .eq("implementation_id", implementationId)
        .order("position");
      if (error) throw error;
      return data as Step[];
    },
  });
  const steps = q.data ?? [];
  const setLocal = (next: Step[]) => qc.setQueryData(key, next);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  useEffect(() => {
    if (!q.data || q.data.length > 0 || seeded.current) return;
    seeded.current = true;
    supabase
      .from(TABLE)
      .insert(DEFAULT_TIMELINE_STEPS.map((title, i) => ({ implementation_id: implementationId, title, position: i })))
      .then(refresh, refresh);
  }, [q.data]);

  async function persistOrder(list: Step[]) {
    const changed = list.map((s, i) => ({ ...s, position: i }));
    setLocal(changed);
    await Promise.all(changed.map((s) => supabase.from(TABLE).update({ position: s.position }).eq("id", s.id)));
    refresh();
  }

  async function setStatus(s: Step, status: Status) {
    const done_at = status === "concluido" ? s.done_at ?? new Date().toISOString() : null;
    setLocal(steps.map((x) => (x.id === s.id ? { ...x, status, done_at } : x)));
    await supabase.from(TABLE).update({ status, done_at }).eq("id", s.id);
    refresh();
  }

  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function setNotes(s: Step, notes: string) {
    setLocal(steps.map((x) => (x.id === s.id ? { ...x, notes } : x)));
    clearTimeout(noteTimers.current[s.id]);
    noteTimers.current[s.id] = setTimeout(() => {
      supabase.from(TABLE).update({ notes: notes || null }).eq("id", s.id).then(() => {});
    }, 600);
  }

  async function addAt(index: number, title: string) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ implementation_id: implementationId, title, position: index })
      .select("id,title,position,done_at,status,notes")
      .single();
    if (error || !data) return;
    const list = [...steps];
    list.splice(index, 0, data as Step);
    await persistOrder(list);
  }

  async function remove(s: Step) {
    if (!confirm(`Remover "${s.title}"?`)) return;
    setLocal(steps.filter((x) => x.id !== s.id));
    await supabase.from(TABLE).delete().eq("id", s.id);
    refresh();
  }

  function drop(to: number) {
    if (drag === null || drag === to) return;
    const list = [...steps];
    const [m] = list.splice(drag, 1);
    if (!m) return;
    list.splice(to, 0, m);
    persistOrder(list);
  }

  const done = steps.filter((s) => s.status === "concluido").length;
  const partial = steps.filter((s) => s.status === "parcial").length;
  const pct = steps.length ? Math.round(((done + partial * 0.5) / steps.length) * 100) : 0;

  const InsertSlot = ({ index }: { index: number }) =>
    insertAt === index ? (
      <form
        className="my-1 ml-11 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = insertTitle.trim();
          if (!t) return;
          addAt(index, t);
          setInsertAt(null);
          setInsertTitle("");
        }}
      >
        <Input autoFocus value={insertTitle} onChange={(e) => setInsertTitle(e.target.value)} placeholder="Nome da etapa" className="h-9" onKeyDown={(e) => e.key === "Escape" && setInsertAt(null)} />
        <Button type="submit" size="sm" disabled={!insertTitle.trim()}>Inserir</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setInsertAt(null)}>Cancelar</Button>
      </form>
    ) : (
      <div className="group/slot relative ml-11 h-3">
        <button
          type="button"
          onClick={() => { setInsertAt(index); setInsertTitle(""); }}
          className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs font-semibold opacity-40 transition-opacity sm:opacity-0 focus:opacity-100 group-hover/slot:opacity-100"
          style={{ color: "var(--stayo-navy)" }}
          aria-label="Inserir etapa aqui"
        >
          <Plus className="size-3.5" /> Inserir etapa aqui
          <span className="h-px flex-1" style={{ background: "var(--stayo-border)" }} />
        </button>
      </div>
    );

  return (
    <section className="rounded-[var(--radius-card)] border bg-white p-5" style={{ borderColor: "var(--stayo-border)" }}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold" style={{ color: "var(--stayo-navy)" }}>Linha do tempo</h2>
        <span className="text-sm font-semibold" style={{ color: "var(--stayo-ink-muted)" }}>
          {done} de {steps.length}{partial ? ` · ${partial} parcial` : ""} · {pct}%
        </span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--stayo-border)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--stayo-success)" }} />
      </div>

      {q.isPending ? (
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>Carregando…</p>
      ) : (
        <ol>
          {steps.map((s, i) => {
            const color = s.status === "concluido" ? "var(--stayo-success)" : s.status === "parcial" ? PARTIAL : "var(--stayo-border)";
            const notesOpen = openNotes === s.id;
            return (
              <li key={s.id}>
                <InsertSlot index={i} />
                <div
                  draggable
                  onDragStart={() => setDrag(i)}
                  onDragOver={(e) => { e.preventDefault(); setOver(i); }}
                  onDragLeave={() => setOver(null)}
                  onDrop={() => { drop(i); setDrag(null); setOver(null); }}
                  onDragEnd={() => { setDrag(null); setOver(null); }}
                  className="rounded-xl border p-2 transition-colors"
                  style={{
                    borderColor: over === i && drag !== i ? "var(--stayo-navy)" : "var(--stayo-border)",
                    opacity: drag === i ? 0.5 : 1,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="size-4 shrink-0 cursor-grab" style={{ color: "var(--stayo-ink-muted)" }} aria-label="Arrastar" />
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold"
                      style={{ borderColor: color, background: s.status === "pendente" ? "white" : color, color: s.status === "pendente" ? "var(--stayo-ink-muted)" : "white" }}
                    >
                      {s.status === "concluido" ? <Check className="size-4" /> : s.status === "parcial" ? <CircleDashed className="size-4" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--stayo-navy)" }}>{s.title}</p>
                      {s.status === "concluido" && s.done_at && (
                        <p className="text-xs" style={{ color: "var(--stayo-success)" }}>Concluído em {new Date(s.done_at).toLocaleDateString("pt-BR")}</p>
                      )}
                      {s.notes && !notesOpen && <p className="truncate text-xs" style={{ color: "var(--stayo-ink-muted)" }}>{s.notes}</p>}
                    </div>
                    <div className="hidden shrink-0 rounded-full border p-0.5 sm:flex" style={{ borderColor: "var(--stayo-border)" }}>
                      {STATUS_OPTS.map((o) => {
                        const active = s.status === o.v;
                        const c = o.v === "concluido" ? "var(--stayo-success)" : o.v === "parcial" ? PARTIAL : "var(--stayo-ink-muted)";
                        return (
                          <button key={o.v} type="button" onClick={() => setStatus(s, o.v)} className="rounded-full px-2.5 py-1 text-xs font-semibold transition-colors"
                            style={{ background: active ? c : "transparent", color: active ? "white" : "var(--stayo-ink-muted)" }}>
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                    <select
                      className="h-8 shrink-0 rounded-md border bg-white px-1 text-xs sm:hidden"
                      style={{ borderColor: "var(--stayo-border)" }}
                      value={s.status}
                      onChange={(e) => setStatus(s, e.target.value as Status)}
                      aria-label="Situação"
                    >
                      {STATUS_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                    </select>
                    <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setOpenNotes(notesOpen ? null : s.id)} aria-label="Observações">
                      <MessageSquare className="size-4" style={{ color: s.notes ? "var(--stayo-navy)" : undefined }} />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => remove(s)} aria-label="Remover etapa">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {notesOpen && (
                    <Textarea
                      autoFocus
                      className="mt-2 min-h-[70px] text-sm"
                      placeholder="Observações desta etapa (salva sozinho)"
                      value={s.notes ?? ""}
                      onChange={(e) => setNotes(s, e.target.value)}
                    />
                  )}
                </div>
              </li>
            );
          })}
          <InsertSlot index={steps.length} />
        </ol>
      )}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = newTitle.trim();
          if (!t) return;
          addAt(steps.length, t);
          setNewTitle("");
        }}
      >
        <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Nova etapa no final, ex.: Entrega das chaves" />
        <Button type="submit" disabled={!newTitle.trim()}><Plus className="size-4" /> Adicionar</Button>
      </form>
    </section>
  );
}
