import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "../MoneyInput";
import {
  ASSIGNMENT_LABELS,
  DEFAULT_ASSIGNMENT_PROCEDURE,
  DEFAULT_ASSIGNMENT_WHO,
  DEFAULT_PAYOUT_RULE,
  DEFAULT_TURNOVER_TEAM,
  OWNER_USE_LIMIT_LABELS,
  TURNOVER_PAYER_LABELS,
} from "../../../lib/contract-conditions";

export type ClauseKey = "owner_use" | "payout" | "turnover" | "exclusivity" | "assignment" | "notice" | "maintenance";

type Field =
  | { key: string; label: string; type: "text" | "textarea"; placeholder?: string; defaultText?: string; showIf?: (v: Values) => boolean }
  | { key: string; label: string; type: "number"; suffix: string; showIf?: (v: Values) => boolean }
  | { key: string; label: string; type: "money"; showIf?: (v: Values) => boolean }
  | { key: string; label: string; type: "bool"; help?: string }
  | { key: string; label: string; type: "choice"; options: Array<{ value: string; label: string }> };

type Values = Record<string, unknown>;

const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));

export const CLAUSES: Record<ClauseKey, { title: string; fields: Field[] }> = {
  owner_use: {
    title: "Uso do imóvel pelo proprietário",
    fields: [
      { key: "owner_use_limit_mode", label: "Limite de uso", type: "choice", options: opts(OWNER_USE_LIMIT_LABELS) },
      { key: "owner_use_limit_days", label: "Quantidade de dias", type: "number", suffix: "dias", showIf: (v) => v["owner_use_limit_mode"] === "limited" },
      { key: "owner_use_limit_period", label: "Período", type: "text", placeholder: "por ano", showIf: (v) => v["owner_use_limit_mode"] === "limited" },
      { key: "owner_use_notice_days", label: "Antecedência do pedido", type: "number", suffix: "dias" },
      { key: "owner_use_notes", label: "Observações (opcional)", type: "textarea" },
    ],
  },
  payout: {
    title: "Repasse",
    fields: [{ key: "payout_rule", label: "Regra de repasse", type: "textarea", defaultText: DEFAULT_PAYOUT_RULE }],
  },
  turnover: {
    title: "Limpeza das hospedagens",
    fields: [
      { key: "turnover_cleaning_team", label: "Quem faz a limpeza", type: "text", defaultText: DEFAULT_TURNOVER_TEAM },
      { key: "turnover_cleaning_payer", label: "Quem paga", type: "choice", options: opts(TURNOVER_PAYER_LABELS) },
    ],
  },
  exclusivity: {
    title: "Exclusividade",
    fields: [
      {
        key: "exclusivity",
        label: "Exclusividade da gestão por temporada",
        type: "bool",
        help: "Durante o contrato, só a STAYO anuncia e administra o imóvel para aluguel por temporada.",
      },
    ],
  },
  assignment: {
    title: "Cessão a terceiros",
    fields: [
      { key: "assignment_mode", label: "Cessão", type: "choice", options: opts(ASSIGNMENT_LABELS) },
      { key: "assignment_who", label: "Quem pode usar", type: "textarea", defaultText: DEFAULT_ASSIGNMENT_WHO },
      { key: "assignment_procedure", label: "Como solicitar", type: "textarea", defaultText: DEFAULT_ASSIGNMENT_PROCEDURE },
    ],
  },
  notice: {
    title: "Aviso prévio",
    fields: [{ key: "notice_period_days", label: "Aviso prévio para encerrar", type: "number", suffix: "dias" }],
  },
  maintenance: {
    title: "Manutenção sem autorização",
    fields: [{ key: "maintenance_limit", label: "Valor máximo por manutenção", type: "money" }],
  },
};

/** Janela simples de uma cláusula: só os campos dela, salvando sozinha. */
export function ClauseEditDialog({
  implementationId,
  clause,
  row,
  onClose,
}: {
  implementationId: string;
  clause: ClauseKey | null;
  row: Values | null | undefined;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const cfg = clause ? CLAUSES[clause] : null;
  const [values, setValues] = useState<Values>({});
  const [last, setLast] = useState<ClauseKey | null>(null);
  if (clause !== last) {
    setLast(clause);
    if (clause) {
      const v: Values = {};
      for (const f of CLAUSES[clause].fields) v[f.key] = row?.[f.key] ?? null;
      setValues(v);
    }
  }
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = useRef(false);
  const set = (k: string, v: unknown) => {
    dirty.current = true;
    setValues((p) => ({ ...p, [k]: v }));
  };

  const save = async (v: Values) => {
    if (!cfg) return;
    const patch: Values = {};
    for (const f of cfg.fields) {
      const raw = v[f.key];
      if (f.type === "text" || f.type === "textarea") patch[f.key] = typeof raw === "string" && raw.trim() ? raw.trim() : null;
      else if (f.type === "number") patch[f.key] = raw === "" || raw == null ? null : Math.max(0, Math.round(Number(raw)));
      else if (f.type === "money") patch[f.key] = raw == null || Number(raw) <= 0 ? null : Number(raw);
      else patch[f.key] = raw ?? null;
    }
    setStatus("saving");
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase
      .from("implementation_contract_conditions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert({ implementation_id: implementationId, ...patch } as any, { onConflict: "implementation_id" });
    if (error) {
      setStatus("error");
      toast.error("Não foi possível salvar.");
      return;
    }
    setStatus("saved");
    await qc.invalidateQueries({ queryKey: ["implementation-contract-conditions", implementationId] });
  };

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => {
      dirty.current = false;
      void save(values);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const close = () => {
    if (dirty.current) {
      dirty.current = false;
      void save(values);
    }
    setStatus("idle");
    onClose();
  };

  return (
    <Dialog open={clause != null} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[90dvh] max-w-md flex-col">
        <DialogHeader>
          <DialogTitle>{cfg?.title}</DialogTitle>
          <DialogDescription>Salva automaticamente e já passa a valer.</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pb-1">
          {cfg?.fields.map((f) => {
            if ("showIf" in f && f.showIf && !f.showIf(values)) return null;
            const id = `clause-${f.key}`;
            const val = values[f.key];
            if (f.type === "bool") {
              return (
                <label key={f.key} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--stayo-border)" }}>
                  <span>
                    <span className="block font-medium" style={{ color: "var(--stayo-navy)" }}>{f.label}</span>
                    {f.help && <span className="mt-0.5 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>{f.help}</span>}
                  </span>
                  <Switch checked={val === true} onCheckedChange={(c) => set(f.key, c)} />
                </label>
              );
            }
            if (f.type === "choice") {
              return (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <Label>{f.label}</Label>
                  <div className="flex flex-wrap gap-2">
                    {f.options.map((o) => {
                      const on = val === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => set(f.key, o.value)}
                          aria-pressed={on}
                          className="min-h-10 rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                          style={
                            on
                              ? { backgroundColor: "var(--stayo-navy)", borderColor: "var(--stayo-navy)", color: "var(--stayo-paper, #fff)" }
                              : { borderColor: "var(--stayo-border)", color: "var(--stayo-navy)", backgroundColor: "var(--background)" }
                          }
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }
            if (f.type === "money") {
              return (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={id}>{f.label}</Label>
                  <MoneyInput id={id} value={val == null ? 0 : Number(val)} onValueChange={(n) => set(f.key, n)} />
                </div>
              );
            }
            if (f.type === "number") {
              return (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={id}>{f.label}</Label>
                  <div className="relative">
                    <Input
                      id={id}
                      inputMode="numeric"
                      value={val == null ? "" : String(val)}
                      onChange={(e) => set(f.key, e.target.value.replace(/\D/g, ""))}
                      className="pr-14"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>{f.suffix}</span>
                  </div>
                </div>
              );
            }
            const text = typeof val === "string" ? val : "";
            return (
              <div key={f.key} className="flex flex-col gap-1.5">
                <Label htmlFor={id}>{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea id={id} rows={3} value={text} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
                ) : (
                  <Input id={id} value={text} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
                )}
                {f.defaultText && text.trim() !== f.defaultText && (
                  <button type="button" onClick={() => set(f.key, f.defaultText)} className="self-start text-xs underline underline-offset-2" style={{ color: "var(--stayo-ink-muted)" }}>
                    Usar texto padrão
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <span className="mr-auto self-center text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            {status === "saving" ? "Salvando…" : status === "saved" ? "Salvo" : status === "error" ? "Erro ao salvar" : ""}
          </span>
          <Button onClick={close}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
