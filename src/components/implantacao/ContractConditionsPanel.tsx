import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Save } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "../ui/textarea";
import { CommercialMeetingPanel } from "./CommercialMeetingPanel";
import { MoneyInput } from "./MoneyInput";
import { supabase } from "../../integrations/supabase/client";
import { formatBRL } from "../../lib/money";
import {
  COST_BEARER_LABELS,
  DEFAULT_PAYOUT_RULE,
  DEFAULT_TURNOVER_TEAM,
  INITIAL_CLEANING_LABELS,
  TURNOVER_PAYER_LABELS,
  contractConditionRows,
  type CostBearer,
  type InitialCleaningOption,
  type TurnoverPayer,
} from "../../lib/contract-conditions";
import type { ProposalSnapshotContractConditions } from "../../types/commercial-proposal";
import type { EntityId } from "../../types/core";

const COLUMNS =
  "implementation_id, administration_fee, cleaning_responsibility, payout_rule, maintenance_limit, exclusivity, duration_months, notice_period_days, initial_cleaning_option, initial_cleaning_other, initial_cleaning_cost_bearer, turnover_cleaning_team, turnover_cleaning_fee, turnover_cleaning_payer, updated_at";

interface ContractConditions {
  implementation_id: string;
  administration_fee: number | null;
  cleaning_responsibility: string | null;
  payout_rule: string | null;
  maintenance_limit: number | null;
  exclusivity: boolean | null;
  duration_months: number | null;
  notice_period_days: number | null;
  initial_cleaning_option: string | null;
  initial_cleaning_other: string | null;
  initial_cleaning_cost_bearer: string | null;
  turnover_cleaning_team: string | null;
  turnover_cleaning_fee: number | null;
  turnover_cleaning_payer: string | null;
  updated_at: string;
}

interface ContractForm {
  administration_fee: string;
  maintenance_limit: number | null;
  initial_cleaning_option: InitialCleaningOption | "";
  initial_cleaning_other: string;
  initial_cleaning_cost_bearer: CostBearer | "";
  turnover_cleaning_team: string;
  turnover_cleaning_fee: number | null;
  turnover_cleaning_payer: TurnoverPayer | "";
  payout_rule: string;
  exclusivity: boolean | null;
  duration_months: string;
  notice_period_days: string;
  legacy_cleaning: string | null;
}

export interface CleaningProposalItem {
  description: string;
  total: number;
  included: boolean;
}

function toForm(v: ContractConditions | null): ContractForm {
  return {
    administration_fee:
      v?.administration_fee == null ? "" : String(v.administration_fee).replace(".", ","),
    maintenance_limit: v?.maintenance_limit ?? null,
    initial_cleaning_option: (v?.initial_cleaning_option as InitialCleaningOption) ?? "",
    initial_cleaning_other: v?.initial_cleaning_other ?? "",
    initial_cleaning_cost_bearer: (v?.initial_cleaning_cost_bearer as CostBearer) ?? "",
    // Sugestão editável; só é gravada se a equipe salvar.
    turnover_cleaning_team: v?.turnover_cleaning_team ?? DEFAULT_TURNOVER_TEAM,
    turnover_cleaning_fee: v?.turnover_cleaning_fee ?? null,
    turnover_cleaning_payer: (v?.turnover_cleaning_payer as TurnoverPayer) ?? "",
    payout_rule: v?.payout_rule ?? "",
    exclusivity: v?.exclusivity ?? null,
    duration_months: v?.duration_months == null ? "" : String(v.duration_months),
    notice_period_days: v?.notice_period_days == null ? "" : String(v.notice_period_days),
    legacy_cleaning: v?.cleaning_responsibility ?? null,
  };
}

function parsePercent(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function toSnapshot(f: ContractForm): ProposalSnapshotContractConditions {
  const fee = parsePercent(f.administration_fee);
  return {
    administrationFee: fee === null || Number.isNaN(fee) || fee < 0 || fee > 100 ? null : fee,
    maintenanceLimit: f.maintenance_limit,
    initialCleaningOption: f.initial_cleaning_option || null,
    initialCleaningOther: f.initial_cleaning_other.trim() || null,
    initialCleaningCostBearer:
      f.initial_cleaning_option === "owner_delivers" ? null : f.initial_cleaning_cost_bearer || null,
    turnoverCleaningTeam: f.turnover_cleaning_team.trim() || null,
    turnoverCleaningFee: f.turnover_cleaning_fee,
    turnoverCleaningPayer: f.turnover_cleaning_fee == null ? null : f.turnover_cleaning_payer || null,
    cleaningResponsibility: f.legacy_cleaning,
    payoutRule: f.payout_rule.trim() || null,
    exclusivity: f.exclusivity,
    durationMonths: f.duration_months ? Number(f.duration_months) : null,
    noticePeriodDays: f.notice_period_days ? Number(f.notice_period_days) : null,
  };
}

function fromRow(v: ContractConditions | null | undefined): ProposalSnapshotContractConditions {
  if (!v) return {};
  return {
    administrationFee: v.administration_fee,
    maintenanceLimit: v.maintenance_limit,
    initialCleaningOption: v.initial_cleaning_option,
    initialCleaningOther: v.initial_cleaning_other,
    initialCleaningCostBearer: v.initial_cleaning_cost_bearer,
    turnoverCleaningTeam: v.turnover_cleaning_team,
    turnoverCleaningFee: v.turnover_cleaning_fee,
    turnoverCleaningPayer: v.turnover_cleaning_payer,
    cleaningResponsibility: v.cleaning_responsibility,
    payoutRule: v.payout_rule,
    exclusivity: v.exclusivity,
    durationMonths: v.duration_months,
    noticePeriodDays: v.notice_period_days,
  };
}

function validate(f: ContractForm): Partial<Record<keyof ContractForm, string>> {
  const e: Partial<Record<keyof ContractForm, string>> = {};
  const fee = parsePercent(f.administration_fee);
  if (fee !== null && (Number.isNaN(fee) || fee < 0 || fee > 100))
    e.administration_fee = "Informe um percentual entre 0% e 100%.";
  if (f.initial_cleaning_option === "other" && !f.initial_cleaning_other.trim())
    e.initial_cleaning_other = "Descreva a condição.";
  for (const key of ["duration_months", "notice_period_days"] as const) {
    const raw = f[key].trim();
    if (raw && !(Number.isInteger(Number(raw)) && Number(raw) >= 0))
      e[key] = "Use um número inteiro.";
  }
  return e;
}

export function ContractConditionsPanel({
  implementationId,
  showMeetings = true,
  cleaningItems,
}: {
  implementationId: EntityId;
  showMeetings?: boolean;
  /** Itens de limpeza do rascunho da proposta (reuso; nunca cria cobrança). */
  cleaningItems?: CleaningProposalItem[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ContractForm>(toForm(null));
  const [initial, setInitial] = useState<ContractForm>(toForm(null));
  const [saveError, setSaveError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["implementation-contract-conditions", implementationId],
    queryFn: async (): Promise<ContractConditions | null> => {
      const { data, error } = await supabase
        .from("implementation_contract_conditions")
        .select(COLUMNS)
        .eq("implementation_id", implementationId)
        .maybeSingle();
      if (error) throw error;
      return data as ContractConditions | null;
    },
  });

  // Carrega o formulário só ao abrir, para não apagar o que está sendo digitado.
  useEffect(() => {
    if (!open) return;
    const f = toForm(query.data ?? null);
    setForm(f);
    setInitial(f);
    setSaveError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const previewRows = useMemo(() => contractConditionRows(toSnapshot(form)), [form]);

  const save = useMutation({
    mutationFn: async (values: ContractForm) => {
      const s = toSnapshot(values);
      const { error } = await supabase.from("implementation_contract_conditions").upsert(
        {
          implementation_id: implementationId,
          administration_fee: s.administrationFee ?? null,
          maintenance_limit: s.maintenanceLimit ?? null,
          initial_cleaning_option: s.initialCleaningOption ?? null,
          initial_cleaning_other:
            values.initial_cleaning_option === "other" ? (s.initialCleaningOther ?? null) : null,
          initial_cleaning_cost_bearer: s.initialCleaningCostBearer ?? null,
          turnover_cleaning_team: s.turnoverCleaningTeam ?? null,
          turnover_cleaning_fee: s.turnoverCleaningFee ?? null,
          turnover_cleaning_payer: s.turnoverCleaningPayer ?? null,
          payout_rule: s.payoutRule ?? null,
          exclusivity: s.exclusivity ?? null,
          duration_months: s.durationMonths ?? null,
          notice_period_days: s.noticePeriodDays ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "implementation_id" },
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["implementation-contract-conditions", implementationId],
      });
      toast.success("Condições salvas");
      setOpen(false);
    },
    onError: (error) => {
      setSaveError(
        error instanceof Error
          ? `Não foi possível salvar: ${error.message}`
          : "Não foi possível salvar. Seus dados continuam no formulário.",
      );
    },
  });

  const set = <K extends keyof ContractForm>(field: K, value: ContractForm[K]) =>
    setForm((c) => ({ ...c, [field]: value }));

  const rows = contractConditionRows(fromRow(query.data));
  const includedCleaning = (cleaningItems ?? []).filter((i) => i.included);
  const stayoCleans =
    form.initial_cleaning_option === "stayo_initial" ||
    form.initial_cleaning_option === "stayo_post_construction" ||
    form.initial_cleaning_option === "other";

  return (
    <div className="space-y-6">
      {showMeetings && (
        <CommercialMeetingPanel implementationId={implementationId} initialResponsibleUserId={null} />
      )}

      <div
        className="rounded-[var(--radius-card)] border bg-white p-4"
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
              Valem para esta implantação. Propostas já publicadas guardam a versão da época.
            </p>
          </div>

          <Dialog
            open={open}
            onOpenChange={(next) => {
              if (!next && dirty && !save.isPending) {
                if (!window.confirm("Descartar as alterações não salvas?")) return;
              }
              setOpen(next);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Pencil className="h-3.5 w-3.5" />
                Editar condições
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>Editar condições contratuais</DialogTitle>
                <DialogDescription>
                  Mudanças aqui não alteram propostas já publicadas ou aceitas.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-5">
                  <Section n={1} title="Administração e manutenção">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field id="administration_fee" label="Taxa de administração" error={errors.administration_fee}>
                        <div className="relative">
                          <Input
                            id="administration_fee"
                            inputMode="decimal"
                            value={form.administration_fee}
                            onChange={(e) =>
                              set("administration_fee", e.target.value.replace(/[^\d,]/g, ""))
                            }
                            placeholder="20"
                            className="pr-8"
                            aria-invalid={Boolean(errors.administration_fee)}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </Field>
                      <Field
                        id="maintenance_limit"
                        label="Limite para manutenção sem autorização prévia"
                        hint="É um limite de autorização, não uma cobrança ao proprietário."
                      >
                        <MoneyInput
                          id="maintenance_limit"
                          value={form.maintenance_limit ?? 0}
                          onValueChange={(v) => set("maintenance_limit", v)}
                        />
                      </Field>
                    </div>
                  </Section>

                  <Section n={2} title="Limpeza inicial do imóvel">
                    <div className="grid gap-2" role="radiogroup" aria-label="Limpeza inicial">
                      {(Object.keys(INITIAL_CLEANING_LABELS) as InitialCleaningOption[]).map((opt) => (
                        <Choice
                          key={opt}
                          name="initial_cleaning"
                          checked={form.initial_cleaning_option === opt}
                          onChange={() => set("initial_cleaning_option", opt)}
                          label={INITIAL_CLEANING_LABELS[opt]}
                        />
                      ))}
                    </div>
                    {form.initial_cleaning_option === "other" && (
                      <Field id="initial_cleaning_other" label="Descreva a condição" error={errors.initial_cleaning_other}>
                        <Input
                          id="initial_cleaning_other"
                          maxLength={300}
                          value={form.initial_cleaning_other}
                          onChange={(e) => set("initial_cleaning_other", e.target.value)}
                        />
                      </Field>
                    )}
                    {stayoCleans && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium">Quem paga o custo</p>
                        <div className="flex flex-wrap gap-2">
                          {(Object.keys(COST_BEARER_LABELS) as CostBearer[]).map((b) => (
                            <Choice
                              key={b}
                              name="initial_cleaning_cost"
                              checked={form.initial_cleaning_cost_bearer === b}
                              onChange={() => set("initial_cleaning_cost_bearer", b)}
                              label={COST_BEARER_LABELS[b]}
                            />
                          ))}
                        </div>
                        {form.initial_cleaning_cost_bearer === "owner" && (
                          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                            {cleaningItems === undefined
                              ? "O valor cobrado vem do item de limpeza na aba Proposta. Nada é cobrado por aqui."
                              : includedCleaning.length > 0
                                ? `Cobrado pelo item da proposta: ${includedCleaning
                                    .map((i) => `${i.description} ${formatBRL(i.total)}`)
                                    .join("; ")}. Nenhuma cobrança nova é criada.`
                                : "Nenhum item de limpeza incluído em Serviços e valores. Para cobrar, inclua o item lá; nada é cobrado por aqui."}
                          </p>
                        )}
                      </div>
                    )}
                  </Section>

                  <Section n={3} title="Limpeza entre hospedagens">
                    <Field id="turnover_team" label="Quem faz">
                      <Input
                        id="turnover_team"
                        maxLength={200}
                        value={form.turnover_cleaning_team}
                        onChange={(e) => set("turnover_cleaning_team", e.target.value)}
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        id="turnover_fee"
                        label="Taxa de limpeza por hospedagem"
                        hint="Não entra no total da implantação."
                      >
                        <MoneyInput
                          id="turnover_fee"
                          value={form.turnover_cleaning_fee ?? 0}
                          onValueChange={(v) => set("turnover_cleaning_fee", v)}
                        />
                      </Field>
                      {form.turnover_cleaning_fee != null && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium">Quem paga</p>
                          {(Object.keys(TURNOVER_PAYER_LABELS) as TurnoverPayer[]).map((p) => (
                            <Choice
                              key={p}
                              name="turnover_payer"
                              checked={form.turnover_cleaning_payer === p}
                              onChange={() => set("turnover_cleaning_payer", p)}
                              label={TURNOVER_PAYER_LABELS[p]}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    {form.turnover_cleaning_fee != null && (
                      <button
                        type="button"
                        className="text-xs underline text-muted-foreground"
                        onClick={() => {
                          set("turnover_cleaning_fee", null);
                          set("turnover_cleaning_payer", "");
                        }}
                      >
                        Sem taxa de limpeza por hospedagem
                      </button>
                    )}
                  </Section>

                  <Section n={4} title="Repasses">
                    <Field id="payout_rule" label="Regra de repasse" hint="Ajuste por implantação, se necessário.">
                      <Textarea
                        id="payout_rule"
                        rows={3}
                        maxLength={1000}
                        value={form.payout_rule}
                        onChange={(e) => set("payout_rule", e.target.value)}
                      />
                    </Field>
                    {form.payout_rule.trim() !== DEFAULT_PAYOUT_RULE && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => set("payout_rule", DEFAULT_PAYOUT_RULE)}>
                        Usar texto padrão
                      </Button>
                    )}
                  </Section>

                  <Section n={5} title="Exclusividade e prazo">
                    <div className="flex items-start justify-between gap-4 rounded-md border px-3 py-3">
                      <div>
                        <Label htmlFor="exclusivity">Exclusividade da gestão de locações por temporada</Label>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Indica se a STAYO será a responsável exclusiva pela gestão das locações por
                          temporada deste imóvel durante a vigência acordada.
                        </p>
                      </div>
                      <Switch
                        id="exclusivity"
                        checked={form.exclusivity ?? false}
                        onCheckedChange={(c) => set("exclusivity", c)}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field id="duration_months" label="Vigência" error={errors.duration_months}>
                        <Suffixed id="duration_months" suffix="meses" value={form.duration_months} onChange={(v) => set("duration_months", v)} />
                      </Field>
                      <Field id="notice_period_days" label="Aviso prévio" error={errors.notice_period_days}>
                        <Suffixed id="notice_period_days" suffix="dias" value={form.notice_period_days} onChange={(v) => set("notice_period_days", v)} />
                      </Field>
                    </div>
                  </Section>
                </div>

                <aside className="lg:sticky lg:top-0 lg:self-start">
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide">Prévia</p>
                      {dirty && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                          Alterações não salvas
                        </span>
                      )}
                    </div>
                    {previewRows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nada preenchido ainda.</p>
                    ) : (
                      <dl className="space-y-2">
                        {previewRows.map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-[11px] text-muted-foreground">{k}</dt>
                            <dd className="text-xs font-medium">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </aside>
              </div>

              {saveError && (
                <p role="alert" className="text-sm text-destructive">
                  {saveError}
                </p>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => save.mutate(form)}
                  disabled={save.isPending || hasErrors || !dirty}
                >
                  <Save className="h-4 w-4" />
                  {save.isPending ? "Salvando..." : "Salvar condições"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {query.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="text-sm text-destructive">Não foi possível carregar as condições contratuais.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma condição preenchida.</p>
        ) : (
          <dl className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map(([label, value]) => (
              <Condition key={label} label={label} value={value} />
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-md border p-4" style={{ borderColor: "var(--stayo-border)" }}>
      <h3 className="text-sm font-semibold">
        <span className="mr-2 text-muted-foreground">{n}.</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Choice({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring ${
        checked ? "border-primary bg-primary/5" : "hover:bg-muted/50"
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="accent-primary" />
      {label}
    </label>
  );
}

function Suffixed({
  id,
  suffix,
  value,
  onChange,
}: {
  id: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="pr-16"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}

function Condition({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 py-2.5 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-baseline">
      <dt className="text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </dt>
      <dd className="text-sm font-semibold sm:text-right" style={{ color: "var(--stayo-ink)" }}>
        {value}
      </dd>
    </div>
  );
}
