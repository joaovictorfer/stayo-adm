import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import {
  ADVISORY_CHOICES,
  COST_BEARER_LABELS,
  INITIAL_CLEANING_CHOICES,
  LINEN_CHOICES,
  type CostBearer,
} from "@/lib/contract-conditions";

type Service = { label: string; value: number | null };
interface Decisions {
  initial_cleaning_option: string | null;
  initial_cleaning_fee: number | null;
  initial_cleaning_cost_bearer: string | null;
  initial_cleaning_notes: string | null;
  linen_mode: string | null;
  linen_notes: string | null;
  advisory_mode: string | null;
  advisory_implementation_desc: string | null;
  advisory_full_desc: string | null;
  advisory_services: Service[];
}
const FIELDS = Object.keys({
  initial_cleaning_option: 1, initial_cleaning_fee: 1, initial_cleaning_cost_bearer: 1,
  initial_cleaning_notes: 1, linen_mode: 1, linen_notes: 1, advisory_mode: 1,
  advisory_implementation_desc: 1, advisory_full_desc: 1, advisory_services: 1,
}).join(",");

const DEFAULT_IMPL_DESC =
  "Planejamento da implantação, lista de itens, orientação de compras e preparação do anúncio.";
const DEFAULT_FULL_DESC =
  "Tudo da assessoria de implantação, com acompanhamento das etapas definidas nesta proposta.";

const empty: Decisions = {
  initial_cleaning_option: null, initial_cleaning_fee: null, initial_cleaning_cost_bearer: null,
  initial_cleaning_notes: null, linen_mode: null, linen_notes: null, advisory_mode: null,
  advisory_implementation_desc: null, advisory_full_desc: null, advisory_services: [],
};

function parseMoney(text: string): number | null {
  const clean = text.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!clean.trim()) return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function MoneyField({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  const [text, setText] = useState(value == null ? "" : value.toFixed(2).replace(".", ","));
  useEffect(() => {
    setText(value == null ? "" : value.toFixed(2).replace(".", ","));
  }, [value]);
  return (
    <label className="block text-xs font-medium">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">R$</span>
        <Input
          inputMode="decimal"
          placeholder="Valor a definir"
          aria-label={label}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => onChange(parseMoney(text))}
          className="max-w-[160px]"
        />
      </div>
    </label>
  );
}

function Options<T extends string>({
  name, question, options, value, onChange,
}: {
  name: string;
  question: string;
  options: Array<{ value: T; label: string; help?: string }>;
  value: string | null;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold">{question}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-control)] border p-3 text-sm has-[:checked]:border-[var(--stayo-forest)] has-[:checked]:bg-[var(--stayo-surface)]"
            style={{ borderColor: "var(--stayo-border)" }}
          >
            <input
              type="radio"
              name={name}
              className="mt-1"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>
              <span className="block font-medium">{o.label}</span>
              {o.help && <span className="block text-xs text-muted-foreground">{o.help}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ImplementationDecisionsPanel({ implementationId }: { implementationId: string }) {
  const queryClient = useQueryClient();
  const key = ["implementation-decisions", implementationId];
  const q = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Decisions> => {
      const { data, error } = await supabase
        .from("implementation_contract_conditions")
        .select(FIELDS)
        .eq("implementation_id", implementationId)
        .maybeSingle();
      if (error) throw error;
      const row = (data ?? {}) as Partial<Decisions>;
      return { ...empty, ...row, advisory_services: Array.isArray(row.advisory_services) ? row.advisory_services : [] };
    },
  });
  const linenQ = useQuery({
    queryKey: ["implementation-decisions", "linen", implementationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implementation_supply_items")
        .select("id,name,required_qty,existing_qty,unit_cost")
        .eq("implementation_id", implementationId)
        .eq("module", "enxoval")
        .order("display_order");
      if (error) throw error;
      return (data ?? []).filter((i) => i.required_qty > i.existing_qty);
    },
  });

  const [d, setD] = useState<Decisions>(empty);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const loaded = useRef(false);
  const lastSaved = useRef("");
  useEffect(() => {
    if (loaded.current || !q.data) return;
    setD(q.data);
    lastSaved.current = JSON.stringify(q.data);
    loaded.current = true;
  }, [q.data]);

  const save = async (value: Decisions) => {
    const sig = JSON.stringify(value);
    if (sig === lastSaved.current) return;
    setState("saving");
    const { error } = await supabase
      .from("implementation_contract_conditions")
      .upsert(
        { implementation_id: implementationId, ...value, updated_at: new Date().toISOString() },
        { onConflict: "implementation_id" },
      );
    if (error) return setState("error");
    lastSaved.current = sig;
    setState("saved");
    void queryClient.invalidateQueries({ queryKey: ["implementation-contract-conditions", implementationId] });
  };
  const dRef = useRef(d);
  dRef.current = d;
  useEffect(() => {
    if (!loaded.current) return;
    const t = window.setTimeout(() => void save(d), 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);
  useEffect(() => {
    const flush = () => loaded.current && void save(dRef.current);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof Decisions>(k: K, v: Decisions[K]) => setD((c) => ({ ...c, [k]: v }));

  const [newItem, setNewItem] = useState({ name: "", qty: "1" });
  const addItem = useMutation({
    mutationFn: async () => {
      const qty = Math.max(1, Number(newItem.qty) || 1);
      const { error } = await supabase.from("implementation_supply_items").insert({
        implementation_id: implementationId,
        module: "enxoval",
        name: newItem.name.trim(),
        required_qty: qty,
        existing_qty: 0,
        display_order: 999,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewItem({ name: "", qty: "1" });
      void queryClient.invalidateQueries({ queryKey: ["implementation-decisions", "linen", implementationId] });
      void queryClient.invalidateQueries({ queryKey: ["supply-items"] });
    },
  });

  const cleaningPaid = d.initial_cleaning_option === "stayo_initial" || d.initial_cleaning_option === "stayo_post_construction";
  const linenBuy = d.linen_mode === "partial" || d.linen_mode === "stayo_supplier";
  const missing = linenQ.data ?? [];

  if (q.isPending) return <p className="text-xs text-muted-foreground">Carregando decisões…</p>;

  return (
    <section
      className="space-y-6 rounded-[var(--radius-card)] border bg-white p-4"
      style={{ borderColor: "var(--stayo-border)" }}
      aria-label="Decisões da implantação"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: "var(--stayo-ink-muted)" }}>
            Decisões da implantação
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Opcionais no rascunho. Entram na proposta ao publicar; versões confirmadas não mudam.
          </p>
        </div>
        <span role="status" className="text-xs text-muted-foreground">
          {state === "saving" ? "Salvando…" : state === "saved" ? "Salvo" : state === "error" ? (
            <button type="button" className="underline" onClick={() => void save(d)}>Não salvo — tentar novamente</button>
          ) : null}
        </span>
      </div>

      <div className="space-y-3">
        <Options
          name="dec-cleaning"
          question="Qual limpeza será necessária antes de iniciar a operação?"
          options={INITIAL_CLEANING_CHOICES}
          value={d.initial_cleaning_option}
          onChange={(v) => set("initial_cleaning_option", v)}
        />
        {cleaningPaid && (
          <div className="flex flex-wrap items-end gap-4">
            <MoneyField label="Valor da limpeza de implantação" value={d.initial_cleaning_fee} onChange={(v) => set("initial_cleaning_fee", v)} />
            <div className="text-xs font-medium">
              <span id="dec-cleaning-payer-label">Quem paga a limpeza de implantação</span>
              <div role="radiogroup" aria-labelledby="dec-cleaning-payer-label" className="mt-1 flex gap-2">
                {(Object.keys(COST_BEARER_LABELS) as CostBearer[]).map((b) => {
                  const on = d.initial_cleaning_cost_bearer === b;
                  return (
                    <Button key={b} id={`dec-cleaning-payer-${b}`} data-testid={`dec-cleaning-payer-${b}`}
                      type="button" size="sm" role="radio" aria-checked={on}
                      aria-label={`Limpeza de implantação paga por: ${COST_BEARER_LABELS[b]}`}
                      variant={on ? "default" : "outline"}
                      onClick={() => set("initial_cleaning_cost_bearer", on ? null : b)}>
                      {COST_BEARER_LABELS[b]}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        <Textarea
          aria-label="Observação da limpeza de implantação"
          placeholder="Observação (opcional)"
          rows={2}
          maxLength={500}
          value={d.initial_cleaning_notes ?? ""}
          onChange={(e) => set("initial_cleaning_notes", e.target.value || null)}
        />
        <p className="text-[11px] text-muted-foreground">Não é a limpeza entre hospedagens, que tem valor e cobrança próprios.</p>
      </div>

      <div className="space-y-3">
        <Options
          name="dec-linen"
          question="Como será definido o enxoval do imóvel?"
          options={LINEN_CHOICES}
          value={d.linen_mode}
          onChange={(v) => set("linen_mode", v)}
        />
        {linenBuy && (
          <div className="space-y-2 rounded-[var(--radius-control)] bg-muted p-3">
            <p className="text-xs font-medium">Itens a comprar</p>
            {missing.length === 0 && <p className="text-xs text-muted-foreground">Nenhum item ainda.</p>}
            <ul className="space-y-1 text-sm">
              {missing.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span>{i.required_qty - i.existing_qty}× {i.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {i.unit_cost != null ? formatBRL(i.unit_cost * (i.required_qty - i.existing_qty)) : "Valor a definir"}
                  </span>
                </li>
              ))}
            </ul>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newItem.name.trim()) addItem.mutate();
              }}
            >
              <Input aria-label="Novo item de enxoval" placeholder="Ex.: Toalha de banho" value={newItem.name}
                onChange={(e) => setNewItem((c) => ({ ...c, name: e.target.value }))} className="min-w-[160px] flex-1" />
              <Input aria-label="Quantidade" inputMode="numeric" value={newItem.qty}
                onChange={(e) => setNewItem((c) => ({ ...c, qty: e.target.value }))} className="w-16" />
              <Button type="submit" size="sm" variant="outline" disabled={addItem.isPending || !newItem.name.trim()}>
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground">A mesma lista da aba Enxoval. Sem preço, aparece como “Valor a definir”.</p>
          </div>
        )}
        <Textarea aria-label="Observação do enxoval" placeholder="Observação (opcional)" rows={2} maxLength={500}
          value={d.linen_notes ?? ""} onChange={(e) => set("linen_notes", e.target.value || null)} />
      </div>

      <div className="space-y-3">
        <Options
          name="dec-advisory"
          question="Qual será o escopo da assessoria?"
          options={ADVISORY_CHOICES}
          value={d.advisory_mode}
          onChange={(v) => {
            setD((c) => ({
              ...c,
              advisory_mode: v,
              advisory_implementation_desc: c.advisory_implementation_desc ?? (v === "implementation_only" ? DEFAULT_IMPL_DESC : null),
              advisory_full_desc: c.advisory_full_desc ?? (v === "full" ? DEFAULT_FULL_DESC : null),
            }));
          }}
        />
        {d.advisory_mode === "implementation_only" && (
          <Textarea aria-label="O que está contemplado na assessoria de implantação" rows={3} maxLength={1000}
            value={d.advisory_implementation_desc ?? ""} onChange={(e) => set("advisory_implementation_desc", e.target.value || null)} />
        )}
        {d.advisory_mode === "full" && (
          <Textarea aria-label="O que está contemplado na assessoria completa" rows={3} maxLength={1000}
            value={d.advisory_full_desc ?? ""} onChange={(e) => set("advisory_full_desc", e.target.value || null)} />
        )}
        {d.advisory_mode && d.advisory_mode !== "tbd" && (
          <div className="space-y-2">
            <p className="text-xs font-medium">Serviços desta modalidade</p>
            {d.advisory_services.map((s, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <Input aria-label={`Serviço ${i + 1}`} placeholder="Serviço" value={s.label} className="min-w-[160px] flex-1"
                  onChange={(e) => set("advisory_services", d.advisory_services.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <MoneyField label="Valor" value={s.value}
                  onChange={(v) => set("advisory_services", d.advisory_services.map((x, j) => (j === i ? { ...x, value: v } : x)))} />
                <Button type="button" size="icon" variant="ghost" aria-label="Remover serviço"
                  onClick={() => set("advisory_services", d.advisory_services.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline"
              onClick={() => set("advisory_services", [...d.advisory_services, { label: "", value: null }])}>
              <Plus className="h-3.5 w-3.5" /> Adicionar serviço
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Só aparece o que você listar aqui. Sem valor, aparece como “valor a definir” e não entra no total.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
