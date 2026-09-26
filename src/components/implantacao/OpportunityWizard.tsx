import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Link2,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Drawer } from "../patterns/Drawer";
import { Button } from "../ui/button";
import { CommercialMeetingPanel } from "./CommercialMeetingPanel";
import { CoverPicker } from "./CoverPicker";
import {
  completeOpportunityDraft,
  getOpportunityDraftState,
  saveOpportunityContact,
} from "../../lib/api/opportunities";
import {
  autosaveOpportunity,
  loadOpportunityForm,
  type FieldSource,
  type FormField,
  type FormValues,
} from "../../lib/api/opportunity-form";
import { useOpportunityAutosave, type SaveState } from "../../hooks/use-opportunity-autosave";
import { formatBrazilianPhone } from "../../lib/owner-form-validation";
import type { ImplementationProject } from "../../types/core";
import { supabase } from "@/integrations/supabase/client";
import { contractRowToSnapshot, implementationDecisionItems } from "../../lib/contract-conditions";

export const WIZARD_STEPS = [
  { id: "proprietario", label: "Proprietário" },
  { id: "imovel", label: "Imóvel" },
  { id: "enxoval", label: "Enxoval" },
  { id: "itens", label: "Itens do apartamento" },
  { id: "faltantes", label: "Itens faltantes" },
  { id: "observacoes", label: "Observações" },
  { id: "condicoes", label: "Condições comerciais e contratuais" },
  { id: "revisao", label: "Revisão e criar implantação" },
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number]["id"];

export function isWizardStep(value: unknown): value is WizardStep {
  return WIZARD_STEPS.some((s) => s.id === value);
}

const inputClass =
  "w-full min-h-11 rounded-[var(--radius-control)] border px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-[var(--stayo-forest)]/20";
const inputStyle = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
  color: "var(--stayo-ink)",
};
const card = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

const FIELD_LABELS: Record<FormField, string> = {
  nickname: "Título",
  condominium_name: "Condomínio / prédio",
  tower: "Torre / bloco",
  unit: "Unidade",
  address: "Endereço",
  city: "Cidade",
  postal_code: "CEP",
  property_type: "Tipo de imóvel",
  bedrooms: "Quartos",
  capacity: "Hóspedes",
  notes: "Observações internas",
  owner_facing_notes: "Informações para o proprietário",
};

/**
 * Formulário progressivo da oportunidade, pensado para preencher durante a
 * reunião. Nenhuma etapa bloqueia o avanço; tudo é salvo automaticamente.
 */
export function OpportunityWizard({
  implementation,
  step,
  initialAction,
  onStepChange,
  onExit,
  renderStep,
}: {
  implementation: ImplementationProject;
  step: WizardStep;
  initialAction?: string | undefined;
  onStepChange: (step: WizardStep) => void;
  onExit: () => void;
  renderStep: (step: WizardStep) => ReactNode;
}) {
  const formQ = useQuery({
    queryKey: ["opportunity", "form", implementation.id],
    queryFn: () => loadOpportunityForm(implementation.id),
    staleTime: Infinity,
  });
  if (formQ.isPending)
    return (
      <p className="flex items-center gap-2 py-8 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
        <Loader2 className="size-4 animate-spin" /> Abrindo o formulário…
      </p>
    );
  if (formQ.isError || !formQ.data)
    return (
      <div role="alert" className="rounded-[var(--radius-card)] border p-4 text-sm" style={card}>
        Não conseguimos abrir o formulário.{" "}
        <button type="button" className="underline" onClick={() => void formQ.refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  return (
    <WizardBody
      implementation={implementation}
      step={step}
      initialAction={initialAction}
      onStepChange={onStepChange}
      onExit={onExit}
      renderStep={renderStep}
      initial={formQ.data.values}
      sources={formQ.data.sources}
    />
  );
}

interface Flushable {
  flush: () => Promise<boolean>;
}

function WizardBody({
  implementation,
  step,
  initialAction,
  onStepChange,
  onExit,
  renderStep,
  initial,
  sources,
}: {
  implementation: ImplementationProject;
  step: WizardStep;
  initialAction?: string | undefined;
  onStepChange: (step: WizardStep) => void;
  onExit: () => void;
  renderStep: (step: WizardStep) => ReactNode;
  initial: FormValues;
  sources: FieldSource[];
}) {
  const queryClient = useQueryClient();
  const index = WIZARD_STEPS.findIndex((s) => s.id === step);
  const [meetingOpen, setMeetingOpen] = useState(initialAction === "reuniao");
  const auto = useOpportunityAutosave(implementation.id, initial);
  const contactRef = useRef<Flushable>({ flush: async () => true });
  const [contactState, setContactState] = useState<SaveState>("idle");
  const [contactError, setContactError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const draft = useQuery({
    queryKey: ["opportunity", "draft-state", implementation.id],
    queryFn: () => getOpportunityDraftState(implementation.id),
  });

  // Guarda a etapa aberta para restaurar ao reabrir.
  useEffect(() => {
    void autosaveOpportunity(implementation.id, { draft_step: step }, {}).catch(() => undefined);
  }, [implementation.id, step]);

  useEffect(() => {
    if (initialAction === "convite" && step === "proprietario") {
      const t = window.setTimeout(
        () =>
          document
            .getElementById("portal-owner-panel")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        400,
      );
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [initialAction, step]);

  const flushAll = useCallback(async () => {
    const [a, b] = await Promise.all([auto.flush(), contactRef.current.flush()]);
    return a && b;
  }, [auto]);

  const guarded = async (action: () => void) => {
    const ok = await flushAll();
    if (!ok) {
      toast.error("Não foi possível salvar agora", {
        description: "O que você digitou continua aqui. Tente novamente.",
      });
    }
    action();
  };

  const goTo = (target: WizardStep) =>
    guarded(() => {
      onStepChange(target);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

  const openInvite = () =>
    void goTo("proprietario").then(() =>
      window.setTimeout(
        () =>
          document
            .getElementById("portal-owner-panel")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        300,
      ),
    );

  const complete = useMutation({
    mutationFn: async () => {
      await flushAll();
      await completeOpportunityDraft(implementation.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["opportunity", "draft-state", implementation.id] });
      toast.success("Implantação criada", {
        description: "O que ficou em branco pode ser completado depois ou pelo proprietário.",
      });
      onExit();
    },
    onError: (e) =>
      toast.error("Não foi possível concluir", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      }),
  });

  const combined: SaveState =
    auto.state === "error" || contactState === "error"
      ? "error"
      : auto.state === "saving" || contactState === "saving"
        ? "saving"
        : auto.state === "saved" || contactState === "saved"
          ? "saved"
          : "idle";
  const values = auto.values ?? initial;

  return (
    <div ref={topRef} className="space-y-4 scroll-mt-4">
      <section className="rounded-[var(--radius-card)] border p-4" style={card}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              {draft.data?.isDraft ? "Oportunidade em rascunho" : "Formulário da oportunidade"} ·{" "}
              {implementation.code}
            </p>
            <p className="mt-1 text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
              Etapa {index + 1} de {WIZARD_STEPS.length}: {WIZARD_STEPS[index]?.label}
            </p>
          </div>
          <SaveBadge
            state={combined}
            error={auto.error ?? contactError}
            onRetry={() => void flushAll()}
          />
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          Preencha só o que souber. Tudo é salvo automaticamente e nenhuma etapa bloqueia o avanço.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void guarded(() => setMeetingOpen(true))}
          >
            <CalendarClock className="size-4" /> Reunião
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={openInvite}>
            <Link2 className="size-4" /> Convite do proprietário
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void guarded(onExit)}>
            <X className="size-4" /> Sair do formulário
          </Button>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--stayo-border)" }}
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={WIZARD_STEPS.length}
          aria-valuenow={index + 1}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${((index + 1) / WIZARD_STEPS.length) * 100}%`,
              backgroundColor: "var(--stayo-forest)",
            }}
          />
        </div>
        <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Etapas">
          {WIZARD_STEPS.map((s, i) => {
            const current = s.id === step;
            const done = i < index;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => void goTo(s.id)}
                  aria-current={current ? "step" : undefined}
                  className="flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition"
                  style={
                    current
                      ? {
                          backgroundColor: "var(--stayo-forest)",
                          borderColor: "var(--stayo-forest)",
                          color: "var(--stayo-surface)",
                        }
                      : {
                          borderColor: "var(--stayo-border)",
                          color: done ? "var(--stayo-forest)" : "var(--stayo-ink-muted)",
                        }
                  }
                >
                  {done ? <Check className="size-3.5" /> : <span>{i + 1}</span>}
                  {s.label}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {auto.conflicts.length > 0 && (
        <section
          role="alert"
          className="rounded-[var(--radius-card)] border p-4"
          style={{ borderColor: "var(--stayo-warning)", backgroundColor: "var(--stayo-gold-soft)" }}
        >
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--stayo-ink)" }}>
            <AlertTriangle className="size-4" /> Alguém alterou estes dados enquanto você editava
          </p>
          <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Nada foi sobrescrito. Escolha qual versão fica.
          </p>
          <ul className="mt-3 space-y-2">
            {auto.conflicts.map((c) => (
              <li key={c.field} className="rounded-[var(--radius-control)] border p-3 text-sm" style={card}>
                <p className="font-medium">{FIELD_LABELS[c.field]}</p>
                <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                  Versão mais recente: <strong>{c.current || "(vazio)"}</strong> · Sua versão:{" "}
                  <strong>{c.mine || "(vazio)"}</strong>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => auto.resolveConflict(c.field, "current")}>
                    Usar a mais recente
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => auto.resolveConflict(c.field, "mine")}>
                    Manter a minha
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === "proprietario" && (
        <ContactForm
          implementation={implementation}
          handleRef={contactRef}
          onState={(s, e) => {
            setContactState(s);
            setContactError(e);
          }}
        />
      )}

      {step === "imovel" ? (
        <div className="space-y-4">
          <FieldsCard
            title="Imóvel"
            text="Registre só o que for conhecido agora."
            fields={[
              ["condominium_name", "text"],
              ["tower", "text"],
              ["unit", "text"],
              ["address", "text"],
              ["city", "text"],
              ["postal_code", "text"],
              ["property_type", "type"],
              ["bedrooms", "number"],
              ["capacity", "number"],
            ]}
            values={values}
            onChange={auto.set}
            onBlur={() => void auto.flush()}
          />
          <CoverPicker
            implementationId={implementation.id}
            propertyName={values.nickname || values.condominium_name || implementation.code}
          />
          <details className="rounded-[var(--radius-card)] border p-4" style={card}>
            <summary className="cursor-pointer text-sm font-medium">
              Mais detalhes do imóvel (ambientes, acessos e Wi-Fi)
            </summary>
            <div className="mt-3">{renderStep("imovel")}</div>
          </details>
        </div>
      ) : step === "observacoes" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <NotesCard
            title="Observações internas"
            text="Só a equipe vê. Anote o que surgiu na conversa."
            value={values.notes}
            onChange={(v) => auto.set("notes", v)}
            onBlur={() => void auto.flush()}
          />
          <NotesCard
            title="Informações para o proprietário"
            text="Poderão aparecer no portal do proprietário, mas só depois que a equipe liberar."
            value={values.owner_facing_notes}
            onChange={(v) => auto.set("owner_facing_notes", v)}
            onBlur={() => void auto.flush()}
          />
        </div>
      ) : step === "revisao" ? (
        <Review
          implementation={implementation}
          values={values}
          onOpen={(s) => void goTo(s)}
          completed={Boolean(draft.data?.completedAt)}
          pending={complete.isPending}
          onComplete={() => complete.mutate()}
        />
      ) : (
        <div>{renderStep(step)}</div>
      )}

      <div
        className="sticky bottom-0 z-10 flex justify-between gap-2 border-t py-3"
        style={{ backgroundColor: "var(--stayo-bg)", borderColor: "var(--stayo-border)" }}
      >
        <Button
          type="button"
          variant="outline"
          disabled={index === 0}
          onClick={() => void goTo(WIZARD_STEPS[index - 1]?.id ?? "proprietario")}
        >
          <ChevronLeft className="size-4" /> Voltar
        </Button>
        {index < WIZARD_STEPS.length - 1 && (
          <Button
            type="button"
            className="bg-[var(--stayo-forest)] text-white hover:bg-[var(--stayo-forest)]/90"
            onClick={() => void goTo(WIZARD_STEPS[index + 1]?.id ?? "revisao")}
          >
            Continuar <ChevronRight className="size-4" />
          </Button>
        )}
      </div>

      <Drawer
        open={meetingOpen}
        onClose={() => setMeetingOpen(false)}
        eyebrow={implementation.code}
        title="Reunião da oportunidade"
      >
        <CommercialMeetingPanel
          implementationId={implementation.id}
          initialResponsibleUserId={implementation.responsibleUserId ?? null}
        />
      </Drawer>
      <SourcesHint sources={sources} />
    </div>
  );
}

function SourcesHint({ sources }: { sources: FieldSource[] }) {
  // Mantido para a revisão via query compartilhada; nada visual aqui.
  void sources;
  return null;
}

function SaveBadge({
  state,
  error,
  onRetry,
}: {
  state: SaveState;
  error: string | null;
  onRetry: () => void;
}) {
  if (state === "error")
    return (
      <span role="status" className="flex items-center gap-2 text-xs" style={{ color: "var(--stayo-danger)" }}>
        <CloudOff className="size-4" />
        <span title={error ?? undefined}>Não salvo</span>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-8 items-center gap-1 rounded-md border px-2 font-medium"
          style={{ borderColor: "var(--stayo-danger)" }}
        >
          <RotateCcw className="size-3.5" /> Tentar novamente
        </button>
      </span>
    );
  return (
    <span role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
      {state === "saving" ? (
        <>
          <Loader2 className="size-3.5 animate-spin" /> Salvando…
        </>
      ) : state === "saved" ? (
        <>
          <Check className="size-3.5" style={{ color: "var(--stayo-forest)" }} /> Salvo
        </>
      ) : null}
    </span>
  );
}

function FieldsCard({
  title,
  text,
  fields,
  values,
  onChange,
  onBlur,
}: {
  title: string;
  text: string;
  fields: Array<[FormField, "text" | "number" | "type"]>;
  values: FormValues;
  onChange: (f: FormField, v: string) => void;
  onBlur: () => void;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border p-4" style={card}>
      <h2 className="text-sm font-semibold" style={{ color: "var(--stayo-ink)" }}>
        {title}
      </h2>
      <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        {text}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([f, kind]) => (
          <label key={f} className="block">
            <span className="mb-1 block text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>
              {FIELD_LABELS[f]}
            </span>
            {kind === "type" ? (
              <select
                value={values[f]}
                onChange={(e) => onChange(f, e.target.value)}
                onBlur={onBlur}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Não informado</option>
                <option value="apartamento">Apartamento</option>
                <option value="casa">Casa</option>
                <option value="studio">Studio</option>
                <option value="cabana">Cabana</option>
                <option value="outro">Outro</option>
              </select>
            ) : (
              <input
                value={values[f]}
                inputMode={kind === "number" ? "numeric" : undefined}
                onChange={(e) =>
                  onChange(f, kind === "number" ? e.target.value.replace(/\D/g, "").slice(0, 3) : e.target.value)
                }
                onBlur={onBlur}
                className={inputClass}
                style={inputStyle}
              />
            )}
          </label>
        ))}
      </div>
    </section>
  );
}

function NotesCard({
  title,
  text,
  value,
  onChange,
  onBlur,
}: {
  title: string;
  text: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border p-4" style={card}>
      <h2 className="text-sm font-semibold" style={{ color: "var(--stayo-ink)" }}>
        {title}
      </h2>
      <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        {text}
      </p>
      <textarea
        value={value}
        aria-label={title}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={8}
        className="mt-3 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
        style={inputStyle}
      />
    </section>
  );
}

function ContactForm({
  implementation,
  handleRef,
  onState,
}: {
  implementation: ImplementationProject;
  handleRef: React.MutableRefObject<Flushable>;
  onState: (s: SaveState, error: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const initial = {
    contactName: implementation.ownerName ?? "",
    phone: implementation.ownerPhone ? formatBrazilianPhone(implementation.ownerPhone) : "",
    title: implementation.nickname ?? "",
  };
  const [form, setForm] = useState(initial);
  const formRef = useRef(form);
  const savedRef = useRef(JSON.stringify(initial));
  const timer = useRef<number | null>(null);
  const running = useRef<Promise<boolean> | null>(null);
  const phoneOnly = !implementation.ownerId && !form.contactName.trim() && form.phone.trim();

  const save = useCallback(async (): Promise<boolean> => {
    if (running.current) await running.current;
    const snap = formRef.current;
    const key = JSON.stringify(snap);
    if (key === savedRef.current) return true;
    // Telefone incompleto não é enviado ainda (evita erro enquanto digita).
    const digits = snap.phone.replace(/\D/g, "");
    if (digits && digits.length < 10) return true;
    onState("saving", null);
    const p = saveOpportunityContact(implementation.id, { ...snap, existingOwnerId: null })
      .then(async () => {
        savedRef.current = key;
        onState("saved", null);
        await queryClient.invalidateQueries({ queryKey: ["implementations"] });
        return true;
      })
      .catch((e: unknown) => {
        onState("error", e instanceof Error ? e.message : "Sem conexão.");
        return false;
      });
    running.current = p;
    const ok = await p;
    running.current = null;
    return ok;
  }, [implementation.id, onState, queryClient]);

  handleRef.current = {
    flush: async () => {
      if (timer.current) window.clearTimeout(timer.current);
      return save();
    },
  };

  const update = (patch: Partial<typeof form>) => {
    const next = { ...formRef.current, ...patch };
    formRef.current = next;
    setForm(next);
    onState("saving", null);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), 800);
  };

  const field = (label: string, key: keyof typeof form, extra: Record<string, unknown> = {}) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </span>
      <input
        value={form[key]}
        onChange={(e) =>
          update({ [key]: key === "phone" ? formatBrazilianPhone(e.target.value) : e.target.value })
        }
        onBlur={() => void save()}
        className={inputClass}
        style={inputStyle}
        {...extra}
      />
    </label>
  );

  return (
    <section className="rounded-[var(--radius-card)] border p-4" style={card}>
      <h2 className="text-sm font-semibold" style={{ color: "var(--stayo-ink)" }}>
        Contato e título
      </h2>
      <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Tudo opcional. Sem título, a oportunidade fica como “{implementation.nickname || implementation.code}”.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {field("Nome do contato (opcional)", "contactName", { maxLength: 120, autoComplete: "off" })}
        {field("Telefone (opcional)", "phone", { inputMode: "tel", placeholder: "(54) 99999-9999" })}
        {field("Título provisório (opcional)", "title", { maxLength: 140 })}
      </div>
      {phoneOnly && (
        <p className="mt-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          O telefone fica guardado quando houver um nome de contato.
        </p>
      )}
    </section>
  );
}

function Review({
  implementation: i,
  values,
  onOpen,
  completed,
  pending,
  onComplete,
}: {
  implementation: ImplementationProject;
  values: FormValues;
  onOpen: (step: WizardStep) => void;
  completed: boolean;
  pending: boolean;
  onComplete: () => void;
}) {
  const sourcesQ = useQuery({
    queryKey: ["opportunity", "sources", i.id],
    queryFn: () => loadOpportunityForm(i.id).then((r) => r.sources),
  });
  const sourceOf = (f: string) => sourcesQ.data?.find((s) => s.field === f)?.source;
  const decisionsQ = useQuery({
    queryKey: ["implementation-decisions", "review", i.id],
    queryFn: async () => {
      const [{ data }, { data: linen }] = await Promise.all([
        supabase.from("implementation_contract_conditions").select("*").eq("implementation_id", i.id).maybeSingle(),
        supabase.from("implementation_supply_items").select("name,required_qty,existing_qty,unit_cost")
          .eq("implementation_id", i.id).eq("module", "enxoval"),
      ]);
      const snap = contractRowToSnapshot(data as Record<string, unknown> | null);
      snap.linenMissingItems = (linen ?? [])
        .filter((l) => l.required_qty > l.existing_qty)
        .map((l) => ({ name: l.name, qty: l.required_qty - l.existing_qty, unitCost: l.unit_cost }));
      return implementationDecisionItems(snap);
    },
  });
  const decisionValue = (label: string) => decisionsQ.data?.find((d) => d.label === label)?.value ?? null;
  const rows: Array<{ step: WizardStep; field?: FormField; label: string; value: string | null }> = [
    { step: "proprietario", field: "nickname", label: "Título", value: values.nickname || i.nickname || null },
    { step: "proprietario", label: "Proprietário", value: i.ownerName || null },
    { step: "proprietario", label: "Telefone", value: i.ownerPhone ? formatBrazilianPhone(i.ownerPhone) : null },
    ...(
      ["condominium_name", "unit", "address", "city", "property_type", "bedrooms", "capacity"] as FormField[]
    ).map((f) => ({ step: "imovel" as WizardStep, field: f, label: FIELD_LABELS[f], value: values[f] || null })),
    { step: "observacoes", field: "notes", label: FIELD_LABELS.notes, value: values.notes || null },
    {
      step: "observacoes",
      field: "owner_facing_notes",
      label: FIELD_LABELS.owner_facing_notes,
      value: values.owner_facing_notes || null,
    },
    { step: "condicoes", label: "Limpeza de implantação", value: decisionValue("Limpeza de implantação") },
    { step: "condicoes", label: "Enxoval", value: decisionValue("Enxoval") },
    { step: "condicoes", label: "Assessoria", value: decisionValue("Assessoria") },
  ];
  const filled = rows.filter((r) => r.value).length;
  return (
    <section className="rounded-[var(--radius-card)] border p-4" style={card}>
      <h2 className="text-sm font-semibold" style={{ color: "var(--stayo-ink)" }}>
        Revisão
      </h2>
      <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        {filled} de {rows.length} informações preenchidas. O que falta não impede criar a implantação.
        Toque numa linha para voltar à etapa.
      </p>
      <dl className="mt-3 divide-y" style={{ borderColor: "var(--stayo-border)" }}>
        {rows.map((r) => {
          const src = r.field ? sourceOf(r.field) : undefined;
          return (
            <button
              key={r.label}
              type="button"
              onClick={() => onOpen(r.step)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-left text-sm"
            >
              <dt style={{ color: "var(--stayo-ink-muted)" }}>
                {r.label}
                {r.value && src && (
                  <span className="ml-2 rounded-full border px-1.5 text-[10px]" style={{ borderColor: "var(--stayo-border)" }}>
                    {src === "owner" ? "Proprietário" : "Equipe"}
                  </span>
                )}
              </dt>
              <dd
                className="max-w-[16rem] truncate text-right"
                style={{ color: r.value ? "var(--stayo-ink)" : "var(--stayo-warning)" }}
              >
                {r.value ?? "Falta"}
              </dd>
            </button>
          );
        })}
      </dl>
      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          disabled={pending}
          onClick={onComplete}
          className="bg-[var(--stayo-forest)] text-white hover:bg-[var(--stayo-forest)]/90"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {completed ? "Voltar à ficha" : "Criar implantação"}
        </Button>
      </div>
    </section>
  );
}
