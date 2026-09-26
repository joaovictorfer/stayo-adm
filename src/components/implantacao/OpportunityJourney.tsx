import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CloudOff,
  Loader2,
  NotebookPen,
  Package,
  ShoppingBasket,
  Sofa,
  Wrench,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { EnxovalTab } from "./EnxovalTab";
import { MissingItemsTab } from "./MissingItemsTab";
import { ProposalTab } from "./ProposalTab";
import { SupplySheet } from "./SupplySheet";
import { PropertySuppliersPanel } from "../suppliers/PropertySuppliersPanel";
import { supabase } from "@/integrations/supabase/client";
import { useOpportunityAutosave, type SaveState } from "../../hooks/use-opportunity-autosave";
import { autosaveOpportunity, loadOpportunityForm, type FormField, type FormValues } from "../../lib/api/opportunity-form";
import { completeOpportunityDraft, saveOpportunityContact } from "../../lib/api/opportunities";
import { formatBrazilianPhone } from "../../lib/owner-form-validation";
import { JOURNEY_STEPS, summarize, validateContact, type JourneyStep } from "../../lib/opportunity-journey";
import type { ImplementationProject } from "../../types/core";

const inputClass =
  "w-full min-h-12 rounded-[var(--radius-control)] border px-3 py-3 text-base outline-none transition focus:ring-2 focus:ring-[var(--stayo-forest)]/25";
const inputStyle = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
  color: "var(--stayo-ink)",
};
const muted = { color: "var(--stayo-ink-muted)" };

type Cond = Partial<
  Record<
    | "administration_fee"
    | "turnover_cleaning_fee"
    | "initial_cleaning_option"
    | "linen_mode"
    | "advisory_mode"
    | "exclusivity"
    | "duration_months"
    | "notice_period_days"
    | "owner_use_limit_mode"
    | "assignment_mode",
    unknown
  >
>;

export function OpportunityJourney(props: {
  implementation: ImplementationProject;
  step: JourneyStep;
  onStepChange: (step: JourneyStep) => void;
  onExit: () => void;
}) {
  const formQ = useQuery({
    queryKey: ["opportunity", "form", props.implementation.id],
    queryFn: () => loadOpportunityForm(props.implementation.id),
    staleTime: Infinity,
  });
  if (formQ.isPending)
    return (
      <p className="flex items-center gap-2 py-10 text-sm" style={muted}>
        <Loader2 className="size-4 animate-spin" /> Abrindo o cadastro…
      </p>
    );
  if (formQ.isError || !formQ.data)
    return (
      <div role="alert" className="py-10 text-sm">
        Não conseguimos abrir o cadastro.{" "}
        <button type="button" className="underline" onClick={() => void formQ.refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  return <JourneyBody {...props} initial={formQ.data.values} />;
}

function JourneyBody({
  implementation,
  step,
  onStepChange,
  onExit,
  initial,
}: {
  implementation: ImplementationProject;
  step: JourneyStep;
  onStepChange: (step: JourneyStep) => void;
  onExit: () => void;
  initial: FormValues;
}) {
  const id = implementation.id;
  const queryClient = useQueryClient();
  const auto = useOpportunityAutosave(id, initial);
  const v = auto.values ?? initial;
  const index = JOURNEY_STEPS.findIndex((s) => s.id === step);
  const topRef = useRef<HTMLDivElement>(null);

  // Contato (nome/telefone) salvo à parte, com o mesmo padrão de debounce.
  const [contact, setContact] = useState({
    name: implementation.ownerName ?? "",
    phone: implementation.ownerPhone ? formatBrazilianPhone(implementation.ownerPhone.replace(/^55/, "")) : "",
  });
  const [contactState, setContactState] = useState<SaveState>("idle");
  const contactTimer = useRef<number | null>(null);
  const contactDirty = useRef(false);
  const saveContact = async (): Promise<boolean> => {
    if (!contactDirty.current) return true;
    const errs = validateContact({ title: v.nickname || "xxx", ...contact });
    if (errs.name || errs.phone) {
      setContactState("error");
      return false;
    }
    setContactState("saving");
    try {
      await saveOpportunityContact(id, { contactName: contact.name, phone: contact.phone, title: "", existingOwnerId: null });
      contactDirty.current = false;
      setContactState("saved");
      void queryClient.invalidateQueries({ queryKey: ["implementations"] });
      return true;
    } catch {
      setContactState("error");
      return false;
    }
  };
  const changeContact = (k: "name" | "phone", value: string) => {
    setContact((c) => ({ ...c, [k]: k === "phone" ? formatBrazilianPhone(value) : value }));
    contactDirty.current = true;
    setContactState("saving");
    if (contactTimer.current) window.clearTimeout(contactTimer.current);
    contactTimer.current = window.setTimeout(() => void saveContact(), 900);
  };

  // Condições da proposta: gravação por coluna em implementation_contract_conditions.
  const condQ = useQuery({
    queryKey: ["implementation-contract-conditions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implementation_contract_conditions")
        .select("*")
        .eq("implementation_id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? {}) as Cond;
    },
  });
  const [cond, setCond] = useState<Cond>({});
  useEffect(() => {
    if (condQ.data) setCond(condQ.data);
  }, [condQ.data]);
  const [condState, setCondState] = useState<SaveState>("idle");
  const condSave = useMutation({
    mutationFn: async (patch: Cond) => {
      const { error } = await supabase
        .from("implementation_contract_conditions")
        .upsert({ implementation_id: id, ...patch, updated_at: new Date().toISOString() } as never, {
          onConflict: "implementation_id",
        });
      if (error) throw error;
    },
    onMutate: () => setCondState("saving"),
    onSuccess: () => setCondState("saved"),
    onError: () => setCondState("error"),
  });
  const lastCond = useRef<Cond>({});
  const setC = (patch: Cond) => {
    setCond((c) => ({ ...c, ...patch }));
    lastCond.current = patch;
    condSave.mutate(patch);
  };

  useEffect(() => {
    void autosaveOpportunity(id, { draft_step: step }, {}).catch(() => undefined);
    topRef.current?.scrollIntoView({ block: "start" });
  }, [id, step]);

  const saveState: SaveState = [auto.state, contactState, condState].includes("error")
    ? "error"
    : [auto.state, contactState, condState].includes("saving")
      ? "saving"
      : [auto.state, contactState, condState].includes("saved")
        ? "saved"
        : "idle";
  const retry = () => {
    void auto.retry();
    void saveContact();
    if (condState === "error") condSave.mutate(lastCond.current);
  };

  const flushAll = async () => {
    if (contactTimer.current) window.clearTimeout(contactTimer.current);
    const [a, b] = await Promise.all([auto.flush(), saveContact()]);
    if (!a || !b)
      toast.error("Não foi possível salvar agora", { description: "O que você digitou continua aqui." });
    return a && b;
  };
  const go = async (next: JourneyStep) => {
    await flushAll();
    onStepChange(next);
  };
  const exit = async () => {
    const ok = await flushAll();
    if (ok) onExit();
  };

  const [sub, setSub] = useState(0);
  const [hub, setHub] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  useEffect(() => {
    setSub(0);
    setHub(null);
    setPublishing(false);
  }, [step]);

  const proposalQuestions = buildProposalQuestions(cond, setC);
  const isLast = index === JOURNEY_STEPS.length - 1;
  const next = () => {
    if (step === "proposta" && sub < proposalQuestions.length - 1) return setSub(sub + 1);
    if (!isLast) void go(JOURNEY_STEPS[index + 1]!.id);
  };
  const back = () => {
    if (hub) return setHub(null);
    if (publishing) return setPublishing(false);
    if (step === "proposta" && sub > 0) return setSub(sub - 1);
    if (index > 0) void go(JOURNEY_STEPS[index - 1]!.id);
    else void exit();
  };

  const complete = useMutation({
    mutationFn: async () => {
      await flushAll();
      await completeOpportunityDraft(id);
    },
    onSuccess: () => {
      toast.success("Ficha criada", { description: "Nada foi enviado ao proprietário." });
      onExit();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível concluir."),
  });

  let content: ReactNode = null;
  if (step === "contato") {
    content = (
      <div className="flex flex-col gap-4">
        <TextField label="Título da implantação" value={v.nickname} onChange={(x) => auto.set("nickname", x)} />
        <TextField label="Nome do proprietário" value={contact.name} onChange={(x) => changeContact("name", x)} />
        <TextField
          label="Telefone / WhatsApp"
          value={contact.phone}
          inputMode="tel"
          onChange={(x) => changeContact("phone", x)}
          error={contactState === "error" ? validateContact({ title: "xxx", ...contact }).phone : undefined}
        />
      </div>
    );
  } else if (step === "imovel") {
    content = <PropertyQuestions v={v} set={auto.set} />;
  } else if (step === "proposta") {
    const q = proposalQuestions[sub]!;
    content = (
      <div className="flex flex-col gap-4">
        <p className="text-xs font-medium" style={muted}>
          Pergunta {sub + 1} de {proposalQuestions.length}
        </p>
        <h3 className="text-lg font-semibold">{q.title}</h3>
        {condQ.isPending ? <Loader2 className="size-4 animate-spin" /> : q.body}
      </div>
    );
  } else if (step === "implantacao") {
    const hubs = [
      { id: "enxoval", label: "Enxoval", icon: Package, node: <SupplySheet implementationId={id} /> },
      { id: "itens", label: "Itens do imóvel", icon: Sofa, node: <EnxovalTab implementationId={id} mode="inventory" /> },
      { id: "fornecedores", label: "Fornecedores", icon: Wrench, node: <PropertySuppliersPanel implementationId={id} /> },
      { id: "faltantes", label: "Itens faltantes", icon: ShoppingBasket, node: <MissingItemsTab implementationId={id} /> },
      {
        id: "observacoes",
        label: "Observações",
        icon: NotebookPen,
        node: (
          <div className="flex flex-col gap-4">
            <TextArea label="Observações internas" value={v.notes} onChange={(x) => auto.set("notes", x)} />
            <TextArea
              label="Informações para o proprietário"
              value={v.owner_facing_notes}
              onChange={(x) => auto.set("owner_facing_notes", x)}
            />
          </div>
        ),
      },
    ];
    const open = hubs.find((h) => h.id === hub);
    content = open ? (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={() => setHub(null)} className="flex min-h-11 items-center gap-1 text-sm font-medium" style={{ color: "var(--stayo-forest)" }}>
          <ArrowLeft className="size-4" /> Voltar para a lista
        </button>
        <h3 className="text-lg font-semibold">{open.label}</h3>
        {open.node}
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">O que você quer registrar agora?</h3>
        <p className="text-sm" style={muted}>
          Preencha um, vários ou nenhum.
        </p>
        {hubs.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setHub(h.id)}
            className="flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] border px-4 text-left transition hover:border-[var(--stayo-forest)]"
            style={inputStyle}
          >
            <h.icon className="size-5 shrink-0" style={{ color: "var(--stayo-forest)" }} />
            <span className="flex-1 font-medium">{h.label}</span>
            <ChevronRight className="size-4" style={muted} />
          </button>
        ))}
      </div>
    );
  } else if (publishing) {
    content = (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={() => setPublishing(false)} className="flex min-h-11 items-center gap-1 text-sm font-medium" style={{ color: "var(--stayo-forest)" }}>
          <ArrowLeft className="size-4" /> Voltar para a revisão
        </button>
        <ProposalTab implementationId={id} />
      </div>
    );
  } else {
    const groups = [
      {
        title: "Contato",
        step: "contato" as const,
        lines: [
          { label: "Título", value: v.nickname },
          { label: "Proprietário", value: contact.name },
          { label: "Telefone", value: contact.phone },
        ],
      },
      {
        title: "Imóvel",
        step: "imovel" as const,
        lines: (["condominium_name", "unit", "address", "city", "property_type", "bedrooms", "capacity"] as FormField[]).map(
          (f) => ({ label: f, value: v[f] }),
        ),
        headline: [v.condominium_name, v.tower, v.unit].filter(Boolean).join(" · "),
      },
      {
        title: "Proposta",
        step: "proposta" as const,
        lines: proposalQuestions.map((q) => ({ label: q.title, value: q.answered ? "ok" : "" })),
      },
    ];
    content = (
      <div className="flex flex-col gap-3">
        {groups.map((g) => {
          const s = summarize(g.lines);
          return (
            <button
              key={g.title}
              type="button"
              onClick={() => void go(g.step)}
              className="rounded-[var(--radius-card)] border p-4 text-left"
              style={inputStyle}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{g.title}</span>
                <span className="text-xs font-medium" style={{ color: "var(--stayo-forest)" }}>
                  Editar
                </span>
              </div>
              {g.title === "Contato" ? (
                s.filled.map((l) => (
                  <p key={l.label} className="mt-1 flex items-center gap-1.5 text-sm">
                    <Check className="size-3.5" style={{ color: "var(--stayo-forest)" }} /> {l.value}
                  </p>
                ))
              ) : g.title === "Imóvel" ? (
                <p className="mt-1 text-sm">{"headline" in g && g.headline ? g.headline : "Sem identificação"}</p>
              ) : (
                <p className="mt-1 flex items-center gap-1.5 text-sm">
                  <Check className="size-3.5" style={{ color: "var(--stayo-forest)" }} /> {s.filled.length} condições registradas
                </p>
              )}
              {s.missing > 0 && (
                <p className="mt-1 text-xs" style={muted}>
                  {s.missing} {s.missing === 1 ? "item para completar depois" : "itens para completar depois"}
                </p>
              )}
            </button>
          );
        })}
        <button type="button" onClick={() => void go("implantacao")} className="rounded-[var(--radius-card)] border p-4 text-left" style={inputStyle}>
          <span className="font-semibold">Implantação</span>
          <p className="mt-1 text-sm" style={muted}>
            Enxoval, itens, fornecedores, faltantes e observações — registre quando quiser.
          </p>
        </button>
        <div className="mt-2 flex flex-col gap-2">
          <Button
            type="button"
            onClick={() => setPublishing(true)}
            className="min-h-12 bg-[var(--stayo-forest)] text-[var(--primary-foreground)] hover:bg-[var(--stayo-forest)]/90"
          >
            Publicar proposta e gerar link
          </Button>
          <Button type="button" variant="outline" className="min-h-12" disabled={complete.isPending} onClick={() => complete.mutate()}>
            {complete.isPending && <Loader2 className="size-4 animate-spin" />} Criar ficha sem enviar
          </Button>
          <Button type="button" variant="ghost" className="min-h-12" onClick={() => void go("contato")}>
            Continuar editando
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={topRef} className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-28 sm:pb-6">
      <header className="flex flex-col gap-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <button type="button" aria-label="Voltar" onClick={back} className="grid size-11 place-items-center rounded-full border" style={inputStyle}>
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-xs" style={muted}>
              {implementation.code} · Etapa {index + 1} de {JOURNEY_STEPS.length}
            </p>
            <h2 className="truncate text-lg font-semibold">{JOURNEY_STEPS[index]!.label}</h2>
          </div>
          <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => void exit()}>
            Salvar e sair
          </Button>
        </div>
        <div className="flex gap-1" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={5}>
          {JOURNEY_STEPS.map((s, i) => (
            <span key={s.id} className="h-1 flex-1 rounded-full" style={{ backgroundColor: i <= index ? "var(--stayo-forest)" : "var(--stayo-border)" }} />
          ))}
        </div>
        <SaveStatus state={saveState} onRetry={retry} />
      </header>

      <div>{content}</div>

      {!(step === "revisao") && !hub && (
        <footer
          className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t px-4 py-3 sm:static sm:border-0 sm:p-0"
          style={{ backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" }}
        >
          <Button type="button" variant="outline" className="min-h-12" onClick={back}>
            Voltar
          </Button>
          <Button
            type="button"
            onClick={next}
            className="min-h-12 flex-1 bg-[var(--stayo-forest)] text-[var(--primary-foreground)] hover:bg-[var(--stayo-forest)]/90 sm:ml-auto sm:flex-none sm:px-8"
          >
            Continuar
          </Button>
        </footer>
      )}
    </div>
  );
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "idle") return null;
  if (state === "error")
    return (
      <p role="status" className="flex items-center gap-1.5 text-xs" style={{ color: "var(--stayo-danger)" }}>
        <CloudOff className="size-3.5" /> Não foi possível salvar ·{" "}
        <button type="button" className="underline" onClick={onRetry}>
          tentar novamente
        </button>
      </p>
    );
  return (
    <p role="status" className="flex items-center gap-1.5 text-xs" style={muted}>
      {state === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      {state === "saving" ? "Salvando…" : "Salvo"}
    </p>
  );
}

function TextField({
  label,
  value,
  onChange,
  inputMode,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "tel" | "numeric" | "decimal";
  error?: string | undefined;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input value={value} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} className={inputClass} style={inputStyle} />
      {error && (
        <span className="mt-1 block text-xs" style={{ color: "var(--stayo-danger)" }}>
          {error}
        </span>
      )}
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <textarea value={value} rows={4} onChange={(e) => onChange(e.target.value)} className={inputClass} style={inputStyle} />
    </label>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | null | undefined;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className="min-h-11 rounded-full border px-4 text-sm font-medium transition"
            style={{
              borderColor: active ? "var(--stayo-forest)" : "var(--stayo-border)",
              backgroundColor: active ? "var(--stayo-forest)" : "var(--stayo-surface)",
              color: active ? "var(--primary-foreground)" : "var(--stayo-ink)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function PropertyQuestions({ v, set }: { v: FormValues; set: (f: FormField, x: string) => void }) {
  const [condo, setCondo] = useState<"sim" | "nao" | "nsei" | null>(v.condominium_name ? "sim" : null);
  const [addr, setAddr] = useState<"sim" | "depois" | null>(v.address || v.city ? "sim" : null);
  const bedroomsValue = v.property_type === "studio" ? "studio" : v.bedrooms ? (Number(v.bedrooms) >= 4 ? "4" : v.bedrooms) : "";
  const capacityValue = v.capacity ? (Number(v.capacity) >= 8 ? "8" : v.capacity) : "";
  return (
    <div className="flex flex-col gap-7">
      <Question title="O imóvel fica em condomínio?">
        <Chips
          label="Condomínio"
          value={condo}
          onChange={setCondo}
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
            { value: "nsei", label: "Ainda não sei" },
          ]}
        />
        {condo === "sim" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="Condomínio / prédio" value={v.condominium_name} onChange={(x) => set("condominium_name", x)} />
            <TextField label="Torre / bloco" value={v.tower} onChange={(x) => set("tower", x)} />
            <TextField label="Unidade" value={v.unit} onChange={(x) => set("unit", x)} />
          </div>
        )}
      </Question>
      <Question title="Você sabe o endereço agora?">
        <Chips
          label="Endereço"
          value={addr}
          onChange={setAddr}
          options={[
            { value: "sim", label: "Preencher" },
            { value: "depois", label: "Completar depois" },
          ]}
        />
        {addr === "sim" && (
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px]">
            <TextField label="Endereço" value={v.address} onChange={(x) => set("address", x)} />
            <TextField label="Cidade" value={v.city} onChange={(x) => set("city", x)} />
            <TextField label="CEP" inputMode="numeric" value={v.postal_code} onChange={(x) => set("postal_code", x)} />
          </div>
        )}
      </Question>
      <Question title="Tipo">
        <Chips
          label="Tipo"
          value={v.property_type || "nsei"}
          onChange={(x) => set("property_type", x === "nsei" ? "" : x)}
          options={[
            { value: "apartamento", label: "Apartamento" },
            { value: "casa", label: "Casa" },
            { value: "studio", label: "Studio" },
            { value: "outro", label: "Outro" },
            { value: "nsei", label: "Não sei" },
          ]}
        />
      </Question>
      <Question title="Quartos">
        <Chips
          label="Quartos"
          value={bedroomsValue || "nsei"}
          onChange={(x) => {
            if (x === "studio") {
              set("property_type", "studio");
              set("bedrooms", "0");
            } else set("bedrooms", x === "nsei" ? "" : x);
          }}
          options={[
            { value: "studio", label: "Studio" },
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
            { value: "4", label: "4+" },
            { value: "nsei", label: "Não sei" },
          ]}
        />
      </Question>
      <Question title="Capacidade de hóspedes">
        <Chips
          label="Capacidade"
          value={capacityValue || "nsei"}
          onChange={(x) => set("capacity", x === "nsei" ? "" : x)}
          options={[
            { value: "2", label: "2" },
            { value: "4", label: "4" },
            { value: "6", label: "6" },
            { value: "8", label: "8+" },
            { value: "nsei", label: "Não sei" },
          ]}
        />
      </Question>
    </div>
  );
}

const TBD = "tbd";
function buildProposalQuestions(c: Cond, setC: (p: Cond) => void) {
  const num = (x: unknown) => (x === null || x === undefined || x === "" ? "" : String(x));
  const boolChoice = c.exclusivity === true ? "sim" : c.exclusivity === false ? "nao" : null;
  const duration = c.duration_months == null ? null : [12, 24].includes(Number(c.duration_months)) ? String(c.duration_months) : "outro";
  const notice = c.notice_period_days == null ? null : [30, 60].includes(Number(c.notice_period_days)) ? String(c.notice_period_days) : "outro";
  return [
    {
      title: "Taxa de administração",
      answered: c.administration_fee != null,
      body: (
        <label className="block max-w-40">
          <span className="sr-only">Taxa em %</span>
          <div className="flex items-center gap-2">
            <input
              inputMode="decimal"
              defaultValue={num(c.administration_fee)}
              onBlur={(e) => {
                const n = Number(e.target.value.replace(",", "."));
                setC({ administration_fee: e.target.value.trim() === "" || Number.isNaN(n) ? null : Math.min(100, Math.max(0, n)) });
              }}
              className={inputClass}
              style={inputStyle}
            />
            <span className="text-lg">%</span>
          </div>
        </label>
      ),
    },
    {
      title: "Limpeza comercial",
      answered: c.turnover_cleaning_fee != null,
      body: (
        <div className="flex flex-col gap-3">
          <div className="flex max-w-52 items-center gap-2">
            <span>R$</span>
            <input
              inputMode="decimal"
              defaultValue={num(c.turnover_cleaning_fee)}
              onBlur={(e) => {
                const n = Number(e.target.value.replace(/\./g, "").replace(",", "."));
                setC({ turnover_cleaning_fee: e.target.value.trim() === "" || Number.isNaN(n) ? null : Math.max(0, n) });
              }}
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <Chips label="Limpeza comercial" value={c.turnover_cleaning_fee == null ? "tbd" : null} onChange={() => setC({ turnover_cleaning_fee: null })} options={[{ value: "tbd", label: "A definir" }]} />
        </div>
      ),
    },
    {
      title: "Limpeza antes da operação",
      answered: c.initial_cleaning_option != null,
      body: (
        <Chips
          label="Limpeza antes da operação"
          value={c.initial_cleaning_option as string}
          onChange={(x) => setC({ initial_cleaning_option: x })}
          options={[
            { value: "owner_delivers", label: "Proprietário entrega limpo" },
            { value: "stayo_initial", label: "Limpeza de implantação STAYO" },
            { value: "stayo_post_construction", label: "Pós-obra" },
            { value: TBD, label: "A decidir" },
          ]}
        />
      ),
    },
    {
      title: "Enxoval",
      answered: c.linen_mode != null,
      body: (
        <Chips
          label="Enxoval"
          value={c.linen_mode as string}
          onChange={(x) => setC({ linen_mode: x })}
          options={[
            { value: "complete", label: "Já possui completo" },
            { value: "partial", label: "Possui parcialmente" },
            { value: "stayo_supplier", label: "Fornecedor indicado pela STAYO" },
            { value: TBD, label: "A decidir" },
          ]}
        />
      ),
    },
    {
      title: "Assessoria",
      answered: c.advisory_mode != null,
      body: (
        <Chips
          label="Assessoria"
          value={c.advisory_mode as string}
          onChange={(x) => setC({ advisory_mode: x })}
          options={[
            { value: "implementation_only", label: "Somente implantação" },
            { value: "full", label: "Completa" },
            { value: TBD, label: "A decidir" },
          ]}
        />
      ),
    },
    {
      title: "Exclusividade",
      answered: c.exclusivity != null,
      body: (
        <Chips
          label="Exclusividade"
          value={boolChoice ?? (c.exclusivity === null && "exclusivity" in c ? TBD : null)}
          onChange={(x) => setC({ exclusivity: x === "sim" ? true : x === "nao" ? false : null })}
          options={[
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
            { value: TBD, label: "A definir" },
          ]}
        />
      ),
    },
    {
      title: "Vigência",
      answered: c.duration_months != null,
      body: (
        <NumberChoice
          value={duration}
          current={num(c.duration_months)}
          unit="meses"
          presets={["12", "24"]}
          onChange={(n) => setC({ duration_months: n })}
        />
      ),
    },
    {
      title: "Aviso prévio",
      answered: c.notice_period_days != null,
      body: (
        <NumberChoice
          value={notice}
          current={num(c.notice_period_days)}
          unit="dias"
          presets={["30", "60"]}
          onChange={(n) => setC({ notice_period_days: n })}
        />
      ),
    },
    {
      title: "Uso próprio pelo proprietário",
      answered: c.owner_use_limit_mode != null,
      body: (
        <Chips
          label="Uso próprio"
          value={c.owner_use_limit_mode as string}
          onChange={(x) => setC({ owner_use_limit_mode: x })}
          options={[
            { value: "unlimited", label: "Sem limite" },
            { value: "limited", label: "Com limite" },
            { value: TBD, label: "A definir" },
          ]}
        />
      ),
    },
    {
      title: "Cessão do imóvel a terceiros",
      answered: c.assignment_mode != null,
      body: (
        <Chips
          label="Cessão"
          value={c.assignment_mode as string}
          onChange={(x) => setC({ assignment_mode: x })}
          options={[
            { value: "allowed", label: "Permitida" },
            { value: "not_allowed", label: "Não permitida" },
            { value: TBD, label: "A definir" },
          ]}
        />
      ),
    },
  ];
}

function NumberChoice({
  value,
  current,
  unit,
  presets,
  onChange,
}: {
  value: string | null;
  current: string;
  unit: string;
  presets: string[];
  onChange: (n: number | null) => void;
}) {
  const [other, setOther] = useState(value === "outro");
  return (
    <div className="flex flex-col gap-3">
      <Chips
        label={unit}
        value={other ? "outro" : value ?? null}
        onChange={(x) => {
          if (x === "outro") return setOther(true);
          setOther(false);
          onChange(x === TBD ? null : Number(x));
        }}
        options={[...presets.map((p) => ({ value: p, label: `${p} ${unit}` })), { value: "outro", label: "Outro" }, { value: TBD, label: "A definir" }]}
      />
      {other && (
        <div className="flex max-w-44 items-center gap-2">
          <input
            inputMode="numeric"
            defaultValue={current}
            onBlur={(e) => {
              const n = parseInt(e.target.value, 10);
              onChange(Number.isNaN(n) ? null : Math.max(0, n));
            }}
            className={inputClass}
            style={inputStyle}
          />
          <span>{unit}</span>
        </div>
      )}
    </div>
  );
}
