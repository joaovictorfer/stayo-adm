import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, ChevronLeft, ChevronRight, Link2, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Drawer } from "../patterns/Drawer";
import { Button } from "../ui/button";
import { CommercialMeetingPanel } from "./CommercialMeetingPanel";
import {
  completeOpportunityDraft,
  getOpportunityDraftState,
  saveOpportunityContact,
} from "../../lib/api/opportunities";
import { formatBrazilianPhone } from "../../lib/owner-form-validation";
import type { ImplementationProject } from "../../types/core";

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
  "w-full rounded-[var(--radius-control)] border px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-[var(--stayo-forest)]/20";
const inputStyle = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
  color: "var(--stayo-ink)",
};

/**
 * Formulário progressivo único da oportunidade. Cada etapa reutiliza a seção
 * já existente da ficha (renderStep); nenhuma etapa exige dado para avançar.
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
  const queryClient = useQueryClient();
  const index = WIZARD_STEPS.findIndex((s) => s.id === step);
  const [meetingOpen, setMeetingOpen] = useState(initialAction === "reuniao");
  const contactRef = useRef<ContactFormHandle>({ save: async () => true });
  const topRef = useRef<HTMLDivElement>(null);
  const draft = useQuery({
    queryKey: ["opportunity", "draft-state", implementation.id],
    queryFn: () => getOpportunityDraftState(implementation.id),
  });

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

  const goTo = async (target: WizardStep) => {
    if (step === "proprietario" && target !== step) {
      const ok = await contactRef.current.save();
      if (!ok) return;
    }
    onStepChange(target);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openInvite = () => {
    void goTo("proprietario").then(() =>
      window.setTimeout(
        () =>
          document
            .getElementById("portal-owner-panel")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        300,
      ),
    );
  };

  const complete = useMutation({
    mutationFn: () => completeOpportunityDraft(implementation.id),
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

  return (
    <div ref={topRef} className="space-y-4 scroll-mt-4">
      <section
        className="rounded-[var(--radius-card)] border p-4"
        style={{ backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
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
            <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              Todos os campos são opcionais. O que ficar em branco pode ser completado depois ou pelo
              proprietário pelo link.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setMeetingOpen(true)}>
              <CalendarClock className="size-4" /> Reunião
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={openInvite}>
              <Link2 className="size-4" /> Convite do proprietário
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onExit}>
              <X className="size-4" /> Sair do formulário
            </Button>
          </div>
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

      {step === "proprietario" && (
        <ContactForm implementation={implementation} handleRef={contactRef} />
      )}

      {step === "revisao" ? (
        <Review
          implementation={implementation}
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
    </div>
  );
}

interface ContactFormHandle {
  save: () => Promise<boolean>;
}

function ContactForm({
  implementation,
  handleRef,
}: {
  implementation: ImplementationProject;
  handleRef: React.MutableRefObject<ContactFormHandle>;
}) {
  const queryClient = useQueryClient();
  const initial = {
    contactName: implementation.ownerName ?? "",
    phone: implementation.ownerPhone ? formatBrazilianPhone(implementation.ownerPhone) : "",
    title: implementation.nickname ?? "",
  };
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const dirty =
    form.contactName !== saved.contactName || form.phone !== saved.phone || form.title !== saved.title;
  const phoneOnly = !implementation.ownerId && !form.contactName.trim() && form.phone.trim();

  const mutation = useMutation({
    mutationFn: () => saveOpportunityContact(implementation.id, { ...form, existingOwnerId: null }),
    onSuccess: async () => {
      setSaved(form);
      await queryClient.invalidateQueries({ queryKey: ["implementations"] });
      toast.success("Dados salvos");
    },
  });

  handleRef.current = {
    save: async () => {
      if (!dirty) return true;
      try {
        await mutation.mutateAsync();
        return true;
      } catch {
        return false;
      }
    },
  };

  return (
    <section
      className="rounded-[var(--radius-card)] border p-4"
      style={{ backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" }}
    >
      <h2 className="text-sm font-semibold" style={{ color: "var(--stayo-ink)" }}>
        Contato e título
      </h2>
      <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Opcional. Sem título, a oportunidade fica como “{implementation.nickname || implementation.code}”.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>
            Nome do contato (opcional)
          </span>
          <input
            value={form.contactName}
            maxLength={120}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>
            Telefone (opcional)
          </span>
          <input
            value={form.phone}
            inputMode="tel"
            placeholder="(54) 99999-9999"
            onChange={(e) => setForm({ ...form, phone: formatBrazilianPhone(e.target.value) })}
            className={inputClass}
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>
            Título provisório (opcional)
          </span>
          <input
            value={form.title}
            maxLength={140}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </label>
      </div>
      {phoneOnly && (
        <p className="mt-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          O telefone fica guardado quando houver um nome de contato.
        </p>
      )}
      {mutation.error && (
        <p role="alert" className="mt-2 text-sm" style={{ color: "var(--stayo-danger)" }}>
          {mutation.error instanceof Error ? mutation.error.message : "Não foi possível salvar."}
        </p>
      )}
      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          {mutation.isPending ? "Salvando…" : dirty ? "Alterações não salvas" : "Salvo"}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
        </Button>
      </div>
    </section>
  );
}

function Review({
  implementation: i,
  onOpen,
  completed,
  pending,
  onComplete,
}: {
  implementation: ImplementationProject;
  onOpen: (step: WizardStep) => void;
  completed: boolean;
  pending: boolean;
  onComplete: () => void;
}) {
  const rows: Array<{ step: WizardStep; label: string; value: string | null }> = [
    { step: "proprietario", label: "Título", value: i.nickname || null },
    { step: "proprietario", label: "Proprietário", value: i.ownerName || null },
    { step: "proprietario", label: "Telefone", value: i.ownerPhone ? formatBrazilianPhone(i.ownerPhone) : null },
    {
      step: "imovel",
      label: "Imóvel",
      value: [i.condominiumName, i.unit, i.address, i.city].filter(Boolean).join(" · ") || null,
    },
    { step: "observacoes", label: "Observações", value: i.notes || null },
  ];
  return (
    <section
      className="rounded-[var(--radius-card)] border p-4"
      style={{ backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" }}
    >
      <h2 className="text-sm font-semibold" style={{ color: "var(--stayo-ink)" }}>
        Revisão
      </h2>
      <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Enxoval, itens, itens faltantes e condições ficam nas próprias etapas. Toque numa linha para
        voltar a ela.
      </p>
      <dl className="mt-3 divide-y" style={{ borderColor: "var(--stayo-border)" }}>
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => onOpen(r.step)}
            className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm"
          >
            <dt style={{ color: "var(--stayo-ink-muted)" }}>{r.label}</dt>
            <dd
              className="truncate text-right"
              style={{ color: r.value ? "var(--stayo-ink)" : "var(--stayo-ink-muted)" }}
            >
              {r.value ?? "A completar"}
            </dd>
          </button>
        ))}
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
