import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, CloudOff, Loader2, MinusCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ItemCondition as Cond } from "@/lib/vistoria/evidence";

/** Configuração do item vinda do SNAPSHOT do modelo da vistoria. */
export interface ItemConfig {
  photo: "obrigatoria" | "opcional" | "nenhuma";
  answer: "condicao" | "sim_nao" | "texto";
  required: boolean;
}

export interface ConditionAnswer { condition?: Cond; value?: string; note?: string }
export type SaveResult = { kind: "salvo" } | { kind: "conflito"; message: string } | { kind: "pendente"; message: string } | { kind: "erro"; message: string };

const OPTIONS: { v: Cond; label: string; icon: typeof CheckCircle2; cls: string; iconCls: string }[] = [
  { v: "ok", label: "OK", icon: CheckCircle2, cls: "border-[oklch(0.82_0.08_155)] bg-[oklch(0.97_0.03_155)]", iconCls: "text-[oklch(0.55_0.16_150)]" },
  { v: "atencao", label: "Atenção", icon: AlertTriangle, cls: "border-[oklch(0.88_0.09_80)] bg-[oklch(0.98_0.03_80)]", iconCls: "text-[oklch(0.7_0.17_60)]" },
  { v: "problema", label: "Problema", icon: CircleAlert, cls: "border-[oklch(0.85_0.07_20)] bg-[oklch(0.97_0.02_20)]", iconCls: "text-[oklch(0.58_0.22_27)]" },
  { v: "nao_aplica", label: "Não se aplica", icon: MinusCircle, cls: "border-border bg-muted", iconCls: "text-muted-foreground" },
];
const NOTE_MAX = 300;
const ATTENTION_MAX = 140;

export function ItemConditionScreen({
  room, name, position, total, config, photoCount, onBack, onSave,
}: {
  room: string; name: string; position: number; total: number; config: ItemConfig; photoCount: number;
  onBack: () => void; onSave: (a: ConditionAnswer, force?: boolean) => Promise<SaveResult>;
}) {
  const [cond, setCond] = useState<Cond | null>(null);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [touched, setTouched] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (cond && cond !== "ok") noteRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [cond]);

  const max = cond === "atencao" ? ATTENTION_MAX : NOTE_MAX;
  const errors: string[] = [];
  if (config.answer === "condicao") {
    if (!cond) errors.push("Escolha uma condição.");
    if (cond === "problema" && !note.trim()) errors.push("Problema exige uma observação.");
    if (cond === "problema" && photoCount < 1) errors.push("Problema exige pelo menos uma foto.");
    if (cond === "nao_aplica" && config.required && !note.trim()) errors.push("Informe o motivo: este item é obrigatório.");
  } else if (config.answer === "sim_nao") {
    if (!value) errors.push("Escolha Sim ou Não.");
  } else if (config.required && !value.trim()) errors.push("Preencha a resposta.");
  if (config.photo === "obrigatoria" && photoCount < 1 && cond !== "nao_aplica") errors.push("Este item exige foto.");

  const save = async (override?: ConditionAnswer, force = false) => {
    setTouched(true);
    if (!override && errors.length) return;
    setSaving(true);
    const r = await onSave(override ?? { ...(cond ? { condition: cond } : {}), ...(value ? { value } : {}), ...(note.trim() ? { note: note.trim() } : {}) }, force);
    setResult(r);
    setSaving(false);
  };

  const pick = (v: Cond) => {
    setCond(v);
    setResult(null);
    if (v === "atencao" && note.length > ATTENTION_MAX) setNote(note.slice(0, ATTENTION_MAX));
    // OK avança direto, desde que as regras do modelo estejam atendidas.
    const okBlocked = config.photo === "obrigatoria" && photoCount < 1;
    if (v === "ok" && !okBlocked) void save({ condition: "ok", ...(note.trim() ? { note: note.trim() } : {}) });
  };

  const noteLabel =
    cond === "problema" ? "Observação (obrigatória)" :
    cond === "nao_aplica" && config.required ? "Motivo (obrigatório)" :
    cond === "atencao" ? "Observação curta (opcional)" : "Observação (opcional)";

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background text-foreground" role="dialog" aria-labelledby="cond-title">
      <header className="flex items-center gap-3 bg-[oklch(0.16_0.03_250)] px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-[oklch(0.98_0_0)]">
        <button onClick={onBack} aria-label="Voltar para a foto" className="grid size-10 place-items-center rounded-full"><ArrowLeft className="size-6" /></button>
        <h2 className="flex-1 text-xl font-semibold">{config.answer === "condicao" ? "Condição do item" : "Resposta do item"}</h2>
        <span className="text-sm tabular-nums opacity-80" aria-label={`Item ${position} de ${total}`}>{position}/{total}</span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-5">
        <p className="text-sm text-muted-foreground">{room}</p>
        <h3 id="cond-title" className="mt-1 text-2xl font-bold">{name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {photoCount} {photoCount === 1 ? "foto" : "fotos"} · foto {config.photo === "obrigatoria" ? "obrigatória" : config.photo === "opcional" ? "opcional" : "não pedida"}{config.required ? " · item obrigatório" : ""}
        </p>

        {config.answer === "condicao" && (
          <div role="radiogroup" aria-label="Condição" className="mt-5 space-y-3">
            {OPTIONS.map((o) => {
              const Icon = o.icon;
              const on = cond === o.v;
              return (
                <button key={o.v} role="radio" aria-checked={on} onClick={() => pick(o.v)} disabled={saving}
                  className={`flex h-16 w-full items-center gap-4 rounded-2xl border-2 px-4 text-left text-lg font-semibold transition ${o.cls} ${on ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                  <Icon className={`size-8 ${o.iconCls}`} aria-hidden /> {o.label}
                </button>
              );
            })}
          </div>
        )}

        {config.answer === "sim_nao" && (
          <div role="radiogroup" aria-label="Resposta" className="mt-5 grid grid-cols-2 gap-3">
            {["Sim", "Não"].map((v) => (
              <button key={v} role="radio" aria-checked={value === v} onClick={() => setValue(v)}
                className={`h-16 rounded-2xl border-2 text-lg font-semibold ${value === v ? "border-primary bg-primary/10" : "border-border"}`}>{v}</button>
            ))}
          </div>
        )}

        {config.answer === "texto" && (
          <label className="mt-5 block">
            <span className="text-sm text-muted-foreground">Resposta{config.required ? " (obrigatória)" : ""}</span>
            <input value={value} maxLength={120} onChange={(e) => setValue(e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3" />
          </label>
        )}

        {(config.answer !== "condicao" || (cond && cond !== "ok")) && (
          <label className="mt-6 block">
            <span className="text-sm text-muted-foreground">{noteLabel}</span>
            <div className="relative mt-1">
              <textarea ref={noteRef} value={note} maxLength={max} onChange={(e) => setNote(e.target.value)} rows={cond === "atencao" ? 2 : 4}
                placeholder="Adicione uma observação, se necessário…" aria-invalid={touched && errors.some((e) => /observação|motivo/i.test(e))}
                className="w-full resize-none rounded-xl border border-border bg-background p-3 pb-7 text-base" />
              <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">{note.length}/{max}</span>
            </div>
          </label>
        )}

        <div aria-live="polite" className="mt-4 space-y-2 text-sm">
          {touched && errors.map((e) => <p key={e} className="text-destructive">{e}</p>)}
          {result?.kind === "salvo" && <p className="text-[oklch(0.5_0.14_150)]">Salvo.</p>}
          {result?.kind === "pendente" && <p className="flex items-center gap-1.5 text-[oklch(0.55_0.14_60)]"><CloudOff className="size-4" /> {result.message}</p>}
          {result?.kind === "erro" && (
            <p className="text-destructive">{result.message} <button onClick={() => void save()} className="font-semibold underline">Tentar de novo</button></p>
          )}
          {result?.kind === "conflito" && (
            <div className="rounded-xl border border-[oklch(0.85_0.09_70)] bg-[oklch(0.97_0.03_80)] p-3">
              <p>{result.message}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => void save(undefined, true)} className="h-10 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground">Manter a minha</button>
                <button onClick={onBack} className="h-10 flex-1 rounded-lg border border-border text-sm font-semibold">Ver a outra</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {!(config.answer === "condicao" && cond === "ok") && (
        <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button onClick={() => void save()} disabled={saving}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} Salvar e continuar <ArrowRight className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
