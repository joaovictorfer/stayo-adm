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
  conditionSections,
  contractRowToSnapshot,
  OWNER_USE_LIMIT_LABELS,
  ASSIGNMENT_LABELS,
  DEFAULT_ASSIGNMENT_WHO,
  DEFAULT_ASSIGNMENT_PROCEDURE,
  type OwnerUseLimitMode,
  type AssignmentMode,
  type ConditionSection,
  type CostBearer,
  type InitialCleaningOption,
  type TurnoverPayer,
} from "../../lib/contract-conditions";
import type { ProposalSnapshotContractConditions } from "../../types/commercial-proposal";
import type { EntityId } from "../../types/core";

const COLUMNS = "*";

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
  initial_cleaning_fee: number | null;
  owner_use_limit_mode: string | null;
  owner_use_limit_days: number | null;
  owner_use_limit_period: string | null;
  owner_use_notice_days: number | null;
  owner_use_notes: string | null;
  assignment_mode: string | null;
  assignment_who: string | null;
  assignment_procedure: string | null;
  assignment_notice_days: number | null;
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
  initial_cleaning_fee: number | null;
  owner_use_limit_mode: OwnerUseLimitMode | "";
  owner_use_limit_days: string;
  owner_use_limit_period: string;
  owner_use_notice_days: string;
  owner_use_notes: string;
  assignment_mode: AssignmentMode | "";
  assignment_who: string;
  assignment_procedure: string;
  assignment_notice_days: string;
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
    initial_cleaning_fee: v?.initial_cleaning_fee ?? null,
    owner_use_limit_mode: (v?.owner_use_limit_mode as OwnerUseLimitMode) ?? "",
    owner_use_limit_days: v?.owner_use_limit_days == null ? "" : String(v.owner_use_limit_days),
    owner_use_limit_period: v?.owner_use_limit_period ?? "por ano",
    owner_use_notice_days: v?.owner_use_notice_days == null ? "" : String(v.owner_use_notice_days),
    owner_use_notes: v?.owner_use_notes ?? "",
    assignment_mode: (v?.assignment_mode as AssignmentMode) ?? "",
    assignment_who: v?.assignment_who ?? DEFAULT_ASSIGNMENT_WHO,
    assignment_procedure: v?.assignment_procedure ?? DEFAULT_ASSIGNMENT_PROCEDURE,
    assignment_notice_days: v?.assignment_notice_days == null ? "" : String(v.assignment_notice_days),
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
    initialCleaningOption: null,
    initialCleaningOther: null,
    initialCleaningCostBearer: null,
    turnoverCleaningTeam: f.turnover_cleaning_team.trim() || null,
    turnoverCleaningFee: f.turnover_cleaning_fee,
    turnoverCleaningPayer: f.turnover_cleaning_fee == null ? null : f.turnover_cleaning_payer || null,
    cleaningResponsibility: f.legacy_cleaning,
    payoutRule: f.payout_rule.trim() || null,
    exclusivity: f.exclusivity,
    durationMonths: f.duration_months ? Number(f.duration_months) : null,
    noticePeriodDays: f.notice_period_days ? Number(f.notice_period_days) : null,
    commercialCleaningFee: f.turnover_cleaning_fee,
    initialCleaningFee: null,
    ownerUseLimitMode: f.owner_use_limit_mode || null,
    ownerUseLimitDays: f.owner_use_limit_mode === "limited" && f.owner_use_limit_days ? Number(f.owner_use_limit_days) : null,
    ownerUseLimitPeriod: f.owner_use_limit_mode === "limited" ? f.owner_use_limit_period.trim() || null : null,
    ownerUseNoticeDays: f.owner_use_notice_days ? Number(f.owner_use_notice_days) : null,
    ownerUseNotes: f.owner_use_notes.trim() || null,
    assignmentMode: f.assignment_mode || null,
    assignmentWho: f.assignment_mode === "allowed" ? f.assignment_who.trim() || null : null,
    assignmentProcedure: f.assignment_mode === "allowed" ? f.assignment_procedure.trim() || null : null,
    assignmentNoticeDays:
      f.assignment_mode === "allowed" && f.assignment_notice_days ? Number(f.assignment_notice_days) : null,
  };
}

function fromRow(v: ContractConditions | null | undefined): ProposalSnapshotContractConditions {
  return contractRowToSnapshot(v as unknown as Record<string, unknown> | null);
}

function validate(f: ContractForm): Partial<Record<keyof ContractForm, string>> {
  const e: Partial<Record<keyof ContractForm, string>> = {};
  const fee = parsePercent(f.administration_fee);
  if (fee !== null && (Number.isNaN(fee) || fee < 0 || fee > 100))
    e.administration_fee = "Informe um percentual entre 0% e 100%.";
  if (f.owner_use_limit_mode === "limited" && !f.owner_use_limit_days.trim())
    e.owner_use_limit_days = "Informe a quantidade de dias.";
  for (const key of [
    "duration_months",
    "notice_period_days",
    "owner_use_limit_days",
    "owner_use_notice_days",
    "assignment_notice_days",
  ] as const) {
    const raw = f[key].trim();
    if (raw && !(Number.isInteger(Number(raw)) && Number(raw) >= 0))
      e[key] = "Use um número inteiro.";
  }
  return e;
}

export function ContractConditionsPanel({
  implementationId,
  showMeetings = true,
  initialOpen = false,
  focusSection = null,
  editorOnly = false,
  onEditorClose,
}: {
  implementationId: EntityId;
  showMeetings?: boolean;
  /** Abre a janela de edição direto, sem passar pelo resumo. */
  initialOpen?: boolean;
  /** Renderiza só a janela de edição (sem resumo nem botão), para uso dentro de outra tela. */
  editorOnly?: boolean;
  /** Chamado quando a janela de edição fecha (modo editorOnly). */
  onEditorClose?: () => void;
  /** Número da seção (1, 2, 3, 5, 6, 7, 8) para rolar até ela ao abrir. */
  focusSection?: number | null;
  /** Itens de limpeza do rascunho da proposta (reuso; nunca cria cobrança). */
  cleaningItems?: CleaningProposalItem[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(initialOpen);
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

  // Ao abrir a edição com uma seção de destino, rola até ela.
  useEffect(() => {
    if (!open || focusSection == null) return;
    const t = window.setTimeout(() => {
      document.getElementById(`cc-section-${focusSection}`)?.scrollIntoView({ block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [open, focusSection]);

  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const previewSections = useMemo(() => conditionSections(toSnapshot(form)), [form]);

  const save = useMutation({
    mutationFn: async (values: ContractForm) => {
      const s = toSnapshot(values);
      const { error } = await supabase.from("implementation_contract_conditions").upsert(
        {
          implementation_id: implementationId,
          administration_fee: s.administrationFee ?? null,
          maintenance_limit: s.maintenanceLimit ?? null,
          turnover_cleaning_team: s.turnoverCleaningTeam ?? null,
          turnover_cleaning_fee: s.turnoverCleaningFee ?? null,
          turnover_cleaning_payer: s.turnoverCleaningPayer ?? null,
          payout_rule: s.payoutRule ?? null,
          exclusivity: s.exclusivity ?? null,
          duration_months: s.durationMonths ?? null,
          notice_period_days: s.noticePeriodDays ?? null,
          owner_use_limit_mode: s.ownerUseLimitMode ?? null,
          owner_use_limit_days: s.ownerUseLimitDays ?? null,
          owner_use_limit_period: s.ownerUseLimitPeriod ?? null,
          owner_use_notice_days: s.ownerUseNoticeDays ?? null,
          owner_use_notes: s.ownerUseNotes ?? null,
          assignment_mode: s.assignmentMode ?? null,
          assignment_who: s.assignmentWho ?? null,
          assignment_procedure: s.assignmentProcedure ?? null,
          assignment_notice_days: s.assignmentNoticeDays ?? null,
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

  const sections = conditionSections(fromRow(query.data)).filter((s) => s.key !== "implementation");

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

                  <Section n={2} title="Limpeza comercial">
                    <Field
                      id="turnover_fee"
                      label="Valor da limpeza comercial deste imóvel"
                      hint="Limpeza padrão do apartamento (ex.: R$ 200, 250 ou 300 conforme o padrão). Usada após hospedagens, uso próprio e cessão. Vazio = a definir."
                    >
                      <NullableMoney
                        id="turnover_fee"
                        value={form.turnover_cleaning_fee}
                        onChange={(v) => set("turnover_cleaning_fee", v)}
                      />
                    </Field>
                  </Section>

                  <Section n={3} title="Limpeza entre hospedagens">
                    <Field id="turnover_team" label="Quem executa">
                      <Input
                        id="turnover_team"
                        maxLength={200}
                        value={form.turnover_cleaning_team}
                        onChange={(e) => set("turnover_cleaning_team", e.target.value)}
                      />
                    </Field>
                    <div className="space-y-2">
                      <p className="text-xs font-medium">Quem paga e como é cobrada</p>
                      {(Object.keys(TURNOVER_PAYER_LABELS) as TurnoverPayer[]).map((p) => (
                        <Choice
                          key={p}
                          name="turnover_payer"
                          checked={form.turnover_cleaning_payer === p}
                          onChange={() => set("turnover_cleaning_payer", p)}
                          label={TURNOVER_PAYER_LABELS[p]}
                        />
                      ))}
                      <p className="text-[11px] text-muted-foreground">
                        Valor usado: {form.turnover_cleaning_fee != null ? formatBRL(form.turnover_cleaning_fee) : "limpeza comercial a definir"}.
                      </p>
                    </div>
                  </Section>

                  <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    A limpeza de implantação, o enxoval e a assessoria ficam em “Decisões da implantação”, acima.
                  </p>

                  <Section n={5} title="Uso pelo proprietário">
                    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Limite de uso próprio">
                      {(Object.keys(OWNER_USE_LIMIT_LABELS) as OwnerUseLimitMode[]).map((m) => (
                        <Choice
                          key={m}
                          name="owner_use_limit"
                          checked={form.owner_use_limit_mode === m}
                          onChange={() => set("owner_use_limit_mode", m)}
                          label={OWNER_USE_LIMIT_LABELS[m]}
                        />
                      ))}
                    </div>
                    {form.owner_use_limit_mode === "limited" && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field id="owner_use_limit_days" label="Quantidade de dias" error={errors.owner_use_limit_days}>
                          <Suffixed id="owner_use_limit_days" suffix="dias" value={form.owner_use_limit_days} onChange={(v) => set("owner_use_limit_days", v)} />
                        </Field>
                        <Field id="owner_use_limit_period" label="Período" hint="Ex.: por ano, por temporada, por mês.">
                          <Input
                            id="owner_use_limit_period"
                            maxLength={60}
                            value={form.owner_use_limit_period}
                            onChange={(e) => set("owner_use_limit_period", e.target.value)}
                          />
                        </Field>
                      </div>
                    )}
                    <Field
                      id="owner_use_notice_days"
                      label="Antecedência mínima para pedir o uso"
                      hint="Vazio = a decidir."
                      error={errors.owner_use_notice_days}
                    >
                      <Suffixed id="owner_use_notice_days" suffix="dias" value={form.owner_use_notice_days} onChange={(v) => set("owner_use_notice_days", v)} />
                    </Field>
                    <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                      Limpeza após o uso: {form.turnover_cleaning_fee != null ? formatBRL(form.turnover_cleaning_fee) : "valor a definir"} (limpeza comercial), cobrada a cada uso.
                    </p>
                    <Field id="owner_use_notes" label="Observações desta proposta">
                      <Textarea
                        id="owner_use_notes"
                        rows={2}
                        maxLength={600}
                        value={form.owner_use_notes}
                        onChange={(e) => set("owner_use_notes", e.target.value)}
                      />
                    </Field>
                  </Section>

                  <Section n={6} title="Cessão de uso a terceiros">
                    <p className="text-[11px] text-muted-foreground">
                      Familiar ou outra pessoa autorizada pelo proprietário. Não é hospedagem comercial nem uso próprio.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Cessão de uso">
                      {(Object.keys(ASSIGNMENT_LABELS) as AssignmentMode[]).map((m) => (
                        <Choice
                          key={m}
                          name="assignment_mode"
                          checked={form.assignment_mode === m}
                          onChange={() => set("assignment_mode", m)}
                          label={ASSIGNMENT_LABELS[m]}
                        />
                      ))}
                    </div>
                    {form.assignment_mode === "allowed" && (
                      <>
                        <Field id="assignment_who" label="A quem pode ser concedida">
                          <Textarea id="assignment_who" rows={2} maxLength={400} value={form.assignment_who} onChange={(e) => set("assignment_who", e.target.value)} />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field id="assignment_notice_days" label="Antecedência mínima" hint="Vazio = a decidir." error={errors.assignment_notice_days}>
                            <Suffixed id="assignment_notice_days" suffix="dias" value={form.assignment_notice_days} onChange={(v) => set("assignment_notice_days", v)} />
                          </Field>
                          <Field id="assignment_procedure" label="Como solicitar">
                            <Textarea id="assignment_procedure" rows={2} maxLength={400} value={form.assignment_procedure} onChange={(e) => set("assignment_procedure", e.target.value)} />
                          </Field>
                        </div>
                        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                          Limpeza após a cessão: {form.turnover_cleaning_fee != null ? formatBRL(form.turnover_cleaning_fee) : "valor a definir"} (limpeza comercial).
                        </p>
                      </>
                    )}
                  </Section>

                  <Section n={7} title="Repasses">
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

                  <Section n={8} title="Exclusividade e prazo">
                    <div className="flex items-start justify-between gap-4 rounded-md border px-3 py-3">
                      <div>
                        <Label htmlFor="exclusivity">Exclusividade da gestão de locações por temporada</Label>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Durante o contrato, só a STAYO anuncia e administra o imóvel para aluguel
                          por temporada (Airbnb, Booking, reservas diretas).
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
                    {previewSections.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nada preenchido ainda.</p>
                    ) : (
                      <ConditionSummary sections={previewSections} compact />
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
        ) : sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma condição preenchida.</p>
        ) : (
          <ConditionSummary sections={sections} />
        )}
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={`cc-section-${n}`} className="space-y-3 rounded-md border p-4" style={{ borderColor: "var(--stayo-border)" }}>
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

function ConditionSummary({ sections, compact = false }: { sections: ConditionSection[]; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-3" : "grid gap-3 md:grid-cols-2"}>
      {sections.map((sec) => (
        <section key={sec.key} className="rounded-md border p-3" style={{ borderColor: "var(--stayo-border)" }}>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
            {sec.title}
          </h4>
          <dl className="space-y-2.5">
            {sec.items.map((it, i) => (
              <div key={`${it.label}${i}`}>
                <dt className="text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>{it.label}</dt>
                <dd className={`text-sm font-semibold ${it.tbd ? "text-amber-700" : ""}`}>{it.value}</dd>
                {it.help && !compact && <dd className="text-[11px] text-muted-foreground">{it.help}</dd>}
              </div>
            ))}
          </dl>
          {sec.note && <p className="mt-2 rounded bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">{sec.note}</p>}
        </section>
      ))}
    </div>
  );
}

function NullableMoney({ id, value, onChange }: { id: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      placeholder="A definir"
      value={value == null ? "" : formatBRL(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
        onChange(digits ? Number.parseInt(digits, 10) / 100 : null);
      }}
      className="text-right tabular-nums"
    />
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
