import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Save } from "lucide-react";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { supabase } from "../../integrations/supabase/client";
import type { EntityId } from "../../types/core";

interface ContractConditions {
  implementation_id: string;
  administration_fee: number | null;
  cleaning_responsibility: string | null;
  payout_rule: string | null;
  maintenance_limit: number | null;
  exclusivity: boolean | null;
  duration_months: number | null;
  notice_period_days: number | null;
  updated_at: string;
}

interface ContractForm {
  administration_fee: string;
  cleaning_responsibility: string;
  payout_rule: string;
  maintenance_limit: string;
  exclusivity: boolean;
  duration_months: string;
  notice_period_days: string;
}

const emptyForm: ContractForm = {
  administration_fee: "",
  cleaning_responsibility: "",
  payout_rule: "",
  maintenance_limit: "",
  exclusivity: false,
  duration_months: "",
  notice_period_days: "",
};

function toForm(value: ContractConditions | null): ContractForm {
  if (!value) return emptyForm;

  return {
    administration_fee: value.administration_fee === null ? "" : String(value.administration_fee),
    cleaning_responsibility: value.cleaning_responsibility ?? "",
    payout_rule: value.payout_rule ?? "",
    maintenance_limit: value.maintenance_limit === null ? "" : String(value.maintenance_limit),
    exclusivity: value.exclusivity ?? false,
    duration_months: value.duration_months === null ? "" : String(value.duration_months),
    notice_period_days: value.notice_period_days === null ? "" : String(value.notice_period_days),
  };
}

function parseNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number | null): string {
  if (value === null || value === undefined) return "Não informado";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

function textValue(value: string | null, fallback = "Não informado"): string {
  return value?.trim() || fallback;
}

export function ContractConditionsPanel({ implementationId }: { implementationId: EntityId }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ContractForm>(emptyForm);

  const query = useQuery({
    queryKey: ["implementation-contract-conditions", implementationId],
    queryFn: async (): Promise<ContractConditions | null> => {
      const { data, error } = await supabase
        .from("implementation_contract_conditions")
        .select(
          "implementation_id, administration_fee, cleaning_responsibility, payout_rule, maintenance_limit, exclusivity, duration_months, notice_period_days, updated_at",
        )
        .eq("implementation_id", implementationId)
        .maybeSingle();

      if (error) throw error;
      return data as ContractConditions | null;
    },
  });

  useEffect(() => {
    if (!open) return;
    setForm(toForm(query.data ?? null));
  }, [open, query.data]);

  const save = useMutation({
    mutationFn: async (values: ContractForm) => {
      const { data, error } = await supabase
        .from("implementation_contract_conditions")
        .upsert(
          {
            implementation_id: implementationId,
            administration_fee: parseNumber(values.administration_fee),
            cleaning_responsibility: values.cleaning_responsibility.trim() || null,
            payout_rule: values.payout_rule.trim() || null,
            maintenance_limit: parseNumber(values.maintenance_limit),
            exclusivity: values.exclusivity,
            duration_months: values.duration_months.trim() === "" ? null : Number(values.duration_months),
            notice_period_days: values.notice_period_days.trim() === "" ? null : Number(values.notice_period_days),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "implementation_id" },
        )
        .select(
          "implementation_id, administration_fee, cleaning_responsibility, payout_rule, maintenance_limit, exclusivity, duration_months, notice_period_days, updated_at",
        )
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["implementation-contract-conditions", implementationId],
      });
      setOpen(false);
    },
  });

  const conditions = query.data;
  const updateField = <K extends keyof ContractForm>(field: K, value: ContractForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <div
      className="rounded-[var(--radius-card)] border bg-white p-4 shadow-sm"
      style={{ borderColor: "var(--stayo-border)" }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p
            className="text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color: "var(--stayo-ink-muted)" }}
          >
            Condições contratuais
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Regras específicas desta implantação
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Pencil className="h-3.5 w-3.5" />
              Editar condições
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Editar condições contratuais</DialogTitle>
              <DialogDescription>
                Atualize as exceções e regras aplicáveis a esta implantação.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="administration_fee">Administração</Label>
                <Input
                  id="administration_fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.administration_fee}
                  onChange={(event) => updateField("administration_fee", event.target.value)}
                  placeholder="Ex.: 20"
                />
                <p className="text-[11px] text-muted-foreground">Valor ou percentual conforme a regra comercial.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenance_limit">Limite de manutenção</Label>
                <Input
                  id="maintenance_limit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.maintenance_limit}
                  onChange={(event) => updateField("maintenance_limit", event.target.value)}
                  placeholder="Ex.: 500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cleaning_responsibility">Limpeza</Label>
                <Input
                  id="cleaning_responsibility"
                  value={form.cleaning_responsibility}
                  onChange={(event) => updateField("cleaning_responsibility", event.target.value)}
                  placeholder="Ex.: Proprietário"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payout_rule">Repasse</Label>
                <Input
                  id="payout_rule"
                  value={form.payout_rule}
                  onChange={(event) => updateField("payout_rule", event.target.value)}
                  placeholder="Ex.: Até o dia 10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration_months">Vigência (meses)</Label>
                <Input
                  id="duration_months"
                  type="number"
                  min="0"
                  step="1"
                  value={form.duration_months}
                  onChange={(event) => updateField("duration_months", event.target.value)}
                  placeholder="Ex.: 12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notice_period_days">Aviso prévio (dias)</Label>
                <Input
                  id="notice_period_days"
                  type="number"
                  min="0"
                  step="1"
                  value={form.notice_period_days}
                  onChange={(event) => updateField("notice_period_days", event.target.value)}
                  placeholder="Ex.: 30"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                <div>
                  <Label htmlFor="exclusivity">Exclusividade</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Indica se o contrato possui exclusividade.</p>
                </div>
                <Switch
                  id="exclusivity"
                  checked={form.exclusivity}
                  onCheckedChange={(checked) => updateField("exclusivity", checked)}
                />
              </div>
            </div>

            {save.isError && (
              <p className="text-sm text-destructive" role="alert">
                Não foi possível salvar as condições contratuais. Tente novamente.
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => save.mutate(form)} disabled={save.isPending} className="gap-2">
                <Save className="h-4 w-4" />
                {save.isPending ? "Salvando..." : "Salvar condições"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {query.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="text-sm text-destructive">Não foi possível carregar as condições contratuais.</p>
      ) : (
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Condition label="Administração" value={money(conditions?.administration_fee ?? null)} />
          <Condition label="Limpeza" value={textValue(conditions?.cleaning_responsibility ?? null)} />
          <Condition label="Repasse" value={textValue(conditions?.payout_rule ?? null)} />
          <Condition label="Manutenção" value={money(conditions?.maintenance_limit ?? null)} />
          <Condition
            label="Exclusividade"
            value={conditions?.exclusivity === null || conditions?.exclusivity === undefined ? "Não informado" : conditions.exclusivity ? "Sim" : "Não"}
          />
          <Condition
            label="Vigência"
            value={conditions?.duration_months == null ? "Não informado" : `${conditions.duration_months} meses`}
          />
          <Condition
            label="Aviso prévio"
            value={conditions?.notice_period_days == null ? "Não informado" : `${conditions.notice_period_days} dias`}
          />
        </div>
      )}
    </div>
  );
}

function Condition({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium" style={{ color: "var(--stayo-ink)" }} title={value}>
        {value}
      </p>
    </div>
  );
}
