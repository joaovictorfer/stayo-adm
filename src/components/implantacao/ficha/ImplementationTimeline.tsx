import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

export const DEFAULT_TIMELINE_STEPS = [
  "Captação do imóvel",
  "Criação de proposta",
  "Reunião comercial",
  "Visita ao imóvel",
  "Limpeza inicial",
  "Vistoria de implantação",
  "Proposta aceita",
  "Assinatura de contrato",
  "Autorização síndico",
  "Autorização no condomínio",
  "Fotos do imóvel",
  "Criação do anúncio",
  "Anúncio ativo",
];

type Step = { id: string; title: string; position: number; done_at: string | null };

export function ImplementationTimeline({ implementationId }: { implementationId: string }) {
  const qc = useQueryClient();
  const key = ["implementation-timeline", implementationId];
  const seeded = useRef(false);
  const [newTitle, setNewTitle] = useState("");

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implementation_timeline_steps")
        .select("id,title,position,done_at")
        .eq("implementation_id", implementationId)
        .order("position");
      if (error) throw error;
      return data as Step[];
    },
  });
  const steps = q.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  // Primeira abertura: cria as etapas padrão da STAYO para esta implantação.
  useEffect(() => {
    if (!q.data || q.data.length > 0 || seeded.current) return;
    seeded.current = true;
    supabase
      .from("implementation_timeline_steps")
      .insert(DEFAULT_TIMELINE_STEPS.map((title, i) => ({ implementation_id: implementationId, title, position: i })))
      .then(refresh);
  }, [q.data]);

  const toggle = useMutation({
    mutationFn: async (s: Step) => {
      const { error } = await supabase
        .from("implementation_timeline_steps")
        .update({ done_at: s.done_at ? null : new Date().toISOString() })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSettled: refresh,
  });
  const add = useMutation({
    mutationFn: async (title: string) => {
      const pos = steps.length ? Math.max(...steps.map((s) => s.position)) + 1 : 0;
      const { error } = await supabase
        .from("implementation_timeline_steps")
        .insert({ implementation_id: implementationId, title, position: pos });
      if (error) throw error;
    },
    onSuccess: () => setNewTitle(""),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("implementation_timeline_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: refresh,
  });
  const move = useMutation({
    mutationFn: async ({ i, dir }: { i: number; dir: -1 | 1 }) => {
      const a = steps[i];
      const b = steps[i + dir];
      if (!a || !b) return;
      await supabase.from("implementation_timeline_steps").update({ position: b.position }).eq("id", a.id);
      await supabase.from("implementation_timeline_steps").update({ position: a.position }).eq("id", b.id);
    },
    onSettled: refresh,
  });

  const done = steps.filter((s) => s.done_at).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;

  return (
    <section className="rounded-[var(--radius-card)] border bg-white p-5" style={{ borderColor: "var(--stayo-border)" }}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold" style={{ color: "var(--stayo-navy)" }}>Linha do tempo</h2>
        <span className="text-sm font-semibold" style={{ color: "var(--stayo-ink-muted)" }}>{done} de {steps.length} · {pct}%</span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--stayo-border)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--stayo-success)" }} />
      </div>

      {q.isPending ? (
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>Carregando…</p>
      ) : (
        <ol className="relative">
          {steps.map((s, i) => {
            const isDone = Boolean(s.done_at);
            return (
              <li key={s.id} className="group relative flex items-center gap-3 py-1.5">
                {i < steps.length - 1 && (
                  <span className="absolute left-[15px] top-[38px] h-[calc(100%-26px)] w-0.5" style={{ background: isDone ? "var(--stayo-success)" : "var(--stayo-border)" }} />
                )}
                <button
                  type="button"
                  onClick={() => toggle.mutate(s)}
                  aria-label={isDone ? `Desmarcar ${s.title}` : `Marcar ${s.title} como feito`}
                  className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors"
                  style={{
                    borderColor: isDone ? "var(--stayo-success)" : "var(--stayo-border)",
                    background: isDone ? "var(--stayo-success)" : "white",
                    color: "white",
                  }}
                >
                  {isDone ? <Check className="size-4" /> : <span className="text-xs font-semibold" style={{ color: "var(--stayo-ink-muted)" }}>{i + 1}</span>}
                </button>
                <button type="button" onClick={() => toggle.mutate(s)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold" style={{ color: isDone ? "var(--stayo-navy)" : "var(--stayo-ink-muted)" }}>{s.title}</p>
                  {isDone && (
                    <p className="text-xs" style={{ color: "var(--stayo-success)" }}>
                      Feito em {new Date(s.done_at!).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </button>
                <div className="flex shrink-0 items-center opacity-60 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="icon" className="size-8" disabled={i === 0} onClick={() => move.mutate({ i, dir: -1 })} aria-label="Subir etapa"><ArrowUp className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="size-8" disabled={i === steps.length - 1} onClick={() => move.mutate({ i, dir: 1 })} aria-label="Descer etapa"><ArrowDown className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => confirm(`Remover "${s.title}"?`) && remove.mutate(s.id)} aria-label="Remover etapa"><Trash2 className="size-4" /></Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = newTitle.trim();
          if (t) add.mutate(t);
        }}
      >
        <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Nova etapa, ex.: Entrega das chaves" />
        <Button type="submit" disabled={!newTitle.trim() || add.isPending}><Plus className="size-4" /> Adicionar</Button>
      </form>
    </section>
  );
}
