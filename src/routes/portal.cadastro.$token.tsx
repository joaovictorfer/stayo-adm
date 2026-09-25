import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  CloudCheck,
  Link2Off,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  ShieldOff,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { StayoLogo } from "../components/brand/StayoLogo";
import {
  propertyTypeLabel,
  propertyTypeOptions,
  resolveIntake,
  saveIntake,
  type OwnerIntakeData,
} from "../lib/api/owner-intake";

/**
 * Página PÚBLICA do cadastro comercial do proprietário.
 * O token só grava na área de revisão (whitelist no banco). Não pede dados
 * bancários, documentos, senhas, códigos ou Wi-Fi.
 */
export const Route = createFileRoute("/portal/cadastro/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Seu cadastro · STAYO" },
      { name: "description", content: "Conte para a STAYO um pouco sobre você e o seu imóvel." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Seu cadastro · STAYO" },
      { property: "og:description", content: "Conte para a STAYO um pouco sobre você e o seu imóvel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntakePage,
});

const STEPS = [
  { title: "Sobre você", hint: "Como falamos com você" },
  { title: "Onde fica", hint: "Localização aproximada" },
  { title: "O imóvel", hint: "Características principais" },
  { title: "Revisão", hint: "Confira e envie" },
];

type Save = "idle" | "saving" | "saved" | "error";

function IntakePage() {
  const { token } = Route.useParams();
  const q = useQuery({
    queryKey: ["owner-intake-public", token],
    queryFn: () => resolveIntake(token),
    retry: false,
    refetchOnWindowFocus: false,
  });

  return (
    <main className="min-h-dvh bg-[var(--stayo-bg)] text-[var(--stayo-ink)]">
      <header className="flex justify-center px-4 pb-2 pt-6">
        <StayoLogo className="h-11 w-auto" />
      </header>
      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-2">
        {q.isPending ? (
          <div className="mt-4 h-72 animate-pulse rounded-2xl bg-[var(--stayo-surface)]" aria-busy="true" />
        ) : !q.data || q.data.state === "network" ? (
          <StateCard icon={<WifiOff className="size-6" />} title="Sem conexão no momento" text="Verifique sua internet e tente de novo. O que você já preencheu está guardado.">
            <button type="button" onClick={() => void q.refetch()} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--stayo-forest-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--stayo-surface)]">
              <RefreshCw className="size-4" /> Tentar de novo
            </button>
          </StateCard>
        ) : q.data.state === "expired" ? (
          <StateCard icon={<Clock className="size-6" />} title="Este link expirou" text="Peça um novo link a quem enviou a mensagem." />
        ) : q.data.state === "revoked" ? (
          <StateCard icon={<ShieldOff className="size-6" />} title="Este link foi desativado" text="Peça o link atualizado a quem enviou a mensagem." />
        ) : q.data.state === "invalid" ? (
          <StateCard icon={<Link2Off className="size-6" />} title="Link inválido" text="Confira se o link foi copiado por inteiro." />
        ) : q.data.status === "submitted" || q.data.status === "approved" ? (
          <StateCard icon={<CheckCircle2 className="size-6 text-[var(--stayo-success)]" />} title="Recebemos seu cadastro" text="Obrigado! A equipe STAYO vai revisar as informações e falar com você pelo WhatsApp. Não é preciso fazer mais nada agora." />
        ) : q.data.status === "discarded" ? (
          <StateCard icon={<ShieldOff className="size-6" />} title="Cadastro encerrado" text="Fale com a equipe STAYO se precisar retomar." />
        ) : (
          <Wizard
            token={token}
            initial={q.data.data}
            initialStep={q.data.currentStep}
            correctionNote={q.data.correctionNote}
            onSubmitted={() => void q.refetch()}
          />
        )}
      </div>
    </main>
  );
}

function Wizard({
  token,
  initial,
  initialStep,
  correctionNote,
  onSubmitted,
}: {
  token: string;
  initial: OwnerIntakeData;
  initialStep: number;
  correctionNote: string | null;
  onSubmitted: () => void;
}) {
  const [data, setData] = useState<OwnerIntakeData>(initial ?? {});
  const [step, setStep] = useState(Math.min(Math.max(initialStep || 1, 1), 4));
  const [save, setSave] = useState<Save>("idle");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ data, step });
  latest.current = { data, step };

  const flush = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setSave("saving");
    try {
      await saveIntake(token, latest.current.data, latest.current.step, false);
      setSave("saved");
    } catch {
      dirty.current = true;
      setSave("error");
    }
  }, [token]);

  const schedule = () => {
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 900);
  };

  useEffect(() => {
    const onHide = () => void flush();
    const onVis = () => document.visibilityState === "hidden" && void flush();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [flush]);

  const set = <K extends keyof OwnerIntakeData>(k: K, v: OwnerIntakeData[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    schedule();
  };

  const phoneDigits = (data.phone ?? "").replace(/\D/g, "");
  const errors: Record<string, string | null> = {
    fullName: (data.fullName ?? "").trim().length < 3 ? "Informe seu nome completo." : null,
    phone: phoneDigits.length < 10 || phoneDigits.length > 13 ? "Informe o telefone com DDD." : null,
    email: data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email) ? "Confira o e-mail." : null,
    city: !(data.city ?? "").trim() ? "Informe a cidade." : null,
    propertyType: !data.propertyType ? "Escolha o tipo do imóvel." : null,
  };
  const stepFields: Record<number, string[]> = { 1: ["fullName", "phone", "email"], 2: ["city"], 3: ["propertyType"], 4: [] };
  const stepValid = (s: number) => stepFields[s].every((f) => !errors[f]);

  const go = (next: number) => {
    if (next > step && !stepValid(step)) {
      setTouched((t) => ({ ...t, ...Object.fromEntries(stepFields[step].map((f) => [f, true])) }));
      return;
    }
    setStep(next);
    dirty.current = true;
    void flush();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (timer.current) clearTimeout(timer.current);
      await saveIntake(token, data, 4, true);
      onSubmitted();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Não foi possível enviar. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  };

  const err = (f: string) => (touched[f] ? errors[f] : null);
  const blur = (f: string) => () => {
    setTouched((t) => ({ ...t, [f]: true }));
    void flush();
  };
  const percent = Math.round(((step - 1) / 3) * 100);

  return (
    <div className="mt-2">
      <div className="rounded-2xl border border-[var(--stayo-border)] bg-[var(--stayo-surface)] p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--stayo-forest)]">Seu cadastro</p>
        <h1 className="mt-1 text-xl font-semibold">Seu cadastro, passo a passo</h1>
        <p className="mt-1 text-sm text-[var(--stayo-ink-muted)]">Leva uns 3 minutos. Você pode parar e voltar depois pelo mesmo link.</p>

        {correctionNote && (
          <div className="mt-4 rounded-xl border border-[var(--stayo-warning)] bg-[var(--stayo-gold-soft)] p-3 text-sm">
            <strong>A equipe pediu um ajuste:</strong> {correctionNote}
          </div>
        )}

        <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Progresso">
          {STEPS.map((s, i) => {
            const n = i + 1;
            return (
              <li key={s.title}>
                <div className="h-1.5 rounded-full transition-colors duration-300" style={{ background: n <= step ? "var(--stayo-forest)" : "var(--stayo-border)" }} />
                <p className={`mt-1.5 truncate text-[11px] ${n === step ? "font-semibold text-[var(--stayo-ink)]" : "text-[var(--stayo-ink-muted)]"}`}>{s.title}</p>
              </li>
            );
          })}
        </ol>
        <div className="mt-2 flex items-center justify-between text-xs text-[var(--stayo-ink-muted)]">
          <span>Etapa {step} de 4 · {percent}%</span>
          <SaveBadge state={save} />
        </div>
      </div>

      <section key={step} className="mt-4 animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-[var(--stayo-border)] bg-[var(--stayo-surface)] p-5 shadow-sm duration-300 sm:p-6">
        <h2 className="text-base font-semibold">{STEPS[step - 1].title}</h2>
        <p className="mb-4 text-xs text-[var(--stayo-ink-muted)]">{STEPS[step - 1].hint}</p>

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Nome completo" error={err("fullName")}>
              <input className="stayo-commercial-input" autoComplete="name" value={data.fullName ?? ""} onChange={(e) => set("fullName", e.target.value)} onBlur={blur("fullName")} />
            </Field>
            <Field label="WhatsApp com DDD" error={err("phone")}>
              <input className="stayo-commercial-input" inputMode="tel" autoComplete="tel" placeholder="(54) 99999-9999" value={data.phone ?? ""} onChange={(e) => set("phone", maskPhone(e.target.value))} onBlur={blur("phone")} />
            </Field>
            <Field label="E-mail" optional error={err("email")}>
              <input className="stayo-commercial-input" type="email" inputMode="email" autoComplete="email" value={data.email ?? ""} onChange={(e) => set("email", e.target.value)} onBlur={blur("email")} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="Cidade" error={err("city")}>
              <input className="stayo-commercial-input" value={data.city ?? ""} onChange={(e) => set("city", e.target.value)} onBlur={blur("city")} placeholder="Gramado" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bairro" optional>
                <input className="stayo-commercial-input" value={data.district ?? ""} onChange={(e) => set("district", e.target.value)} onBlur={blur("district")} />
              </Field>
              <Field label="CEP" optional>
                <input className="stayo-commercial-input" inputMode="numeric" value={data.postalCode ?? ""} onChange={(e) => set("postalCode", maskCep(e.target.value))} onBlur={blur("postalCode")} />
              </Field>
            </div>
            <Field label="Nome do condomínio ou prédio" optional>
              <input className="stayo-commercial-input" value={data.locationName ?? ""} onChange={(e) => set("locationName", e.target.value)} onBlur={blur("locationName")} />
            </Field>
            <Field label="Como você identifica o imóvel" optional>
              <input className="stayo-commercial-input" placeholder="Ex.: apto 302, torre B" value={data.unitLabel ?? ""} onChange={(e) => set("unitLabel", e.target.value)} onBlur={blur("unitLabel")} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <Field label="Tipo do imóvel" error={err("propertyType")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {propertyTypeOptions.map((o) => {
                  const active = data.propertyType === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        set("propertyType", o.value);
                        setTouched((t) => ({ ...t, propertyType: true }));
                      }}
                      className="rounded-xl border px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.97]"
                      style={{
                        borderColor: active ? "var(--stayo-forest)" : "var(--stayo-border)",
                        background: active ? "var(--stayo-forest-soft)" : "var(--stayo-surface)",
                        color: active ? "var(--stayo-forest-strong)" : "var(--stayo-ink)",
                      }}
                      aria-pressed={active}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Stepper label="Quartos" value={data.bedrooms} onChange={(v) => set("bedrooms", v)} />
            <Stepper label="Banheiros" value={data.bathrooms} onChange={(v) => set("bathrooms", v)} />
            <Stepper label="Hóspedes (aproximado)" value={data.capacity} onChange={(v) => set("capacity", v)} />
            <Field label="Algo mais que devemos saber?" optional>
              <textarea className="stayo-commercial-input" rows={3} placeholder="Ex.: tem lareira, vista para o vale, já foi alugado antes…" value={data.notes ?? ""} onChange={(e) => set("notes", e.target.value)} onBlur={blur("notes")} />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <Review title="Sobre você" onEdit={() => setStep(1)} rows={[["Nome", data.fullName], ["WhatsApp", data.phone], ["E-mail", data.email]]} />
            <Review title="Onde fica" onEdit={() => setStep(2)} rows={[["Cidade", data.city], ["Bairro", data.district], ["CEP", data.postalCode], ["Condomínio/prédio", data.locationName], ["Identificação", data.unitLabel]]} />
            <Review title="O imóvel" onEdit={() => setStep(3)} rows={[["Tipo", propertyTypeLabel(data.propertyType)], ["Quartos", data.bedrooms], ["Banheiros", data.bathrooms], ["Hóspedes", data.capacity], ["Observações", data.notes]]} />
            <p className="text-xs text-[var(--stayo-ink-muted)]">Ao enviar, a equipe STAYO revisa as informações antes de usá-las. Nenhum dado bancário ou documento é pedido agora.</p>
            {submitError && <p role="alert" className="text-sm text-[var(--stayo-danger)]">{submitError}</p>}
          </div>
        )}

        <div className="mt-6 flex gap-2">
          {step > 1 && (
            <button type="button" onClick={() => go(step - 1)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--stayo-border)] px-4 py-2.5 text-sm font-medium">
              <ArrowLeft className="size-4" /> Voltar
            </button>
          )}
          {step < 4 ? (
            <button type="button" onClick={() => go(step + 1)} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--stayo-forest-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--stayo-surface)] transition-transform active:scale-[0.97]">
              Continuar <ArrowRight className="size-4" />
            </button>
          ) : (
            <button type="button" disabled={submitting || !stepValid(1) || !stepValid(2) || !stepValid(3)} onClick={() => void submit()} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--stayo-forest-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--stayo-surface)] transition-transform active:scale-[0.97] disabled:opacity-50">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {submitting ? "Enviando…" : "Enviar cadastro"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function SaveBadge({ state }: { state: Save }) {
  if (state === "idle") return <span>Salvo automaticamente</span>;
  if (state === "saving") return <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Salvando…</span>;
  if (state === "error") return <span className="text-[var(--stayo-danger)]">Não salvou — tentaremos de novo</span>;
  return <span className="inline-flex items-center gap-1 text-[var(--stayo-success)]"><CloudCheck className="size-3.5" /> Salvo</span>;
}

function Field({ label, optional, error, children }: { label: string; optional?: boolean; error?: string | null; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium">
        {label} {optional && <span className="text-xs font-normal text-[var(--stayo-ink-muted)]">(opcional)</span>}
      </p>
      {children}
      {error && <p className="mt-1 text-xs text-[var(--stayo-danger)]">{error}</p>}
    </div>
  );
}

function Stepper({ label, value, onChange }: { label: string; value?: number; onChange: (v: number) => void }) {
  const v = value ?? 0;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Diminuir ${label}`} disabled={v <= 0} onClick={() => onChange(Math.max(0, v - 1))} className="flex size-9 items-center justify-center rounded-full border border-[var(--stayo-border)] disabled:opacity-40 active:scale-95">
          <Minus className="size-4" />
        </button>
        <span className="w-6 text-center text-base font-semibold tabular-nums">{v}</span>
        <button type="button" aria-label={`Aumentar ${label}`} disabled={v >= 50} onClick={() => onChange(Math.min(50, v + 1))} className="flex size-9 items-center justify-center rounded-full border border-[var(--stayo-border)] active:scale-95">
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Review({ title, rows, onEdit }: { title: string; rows: Array<[string, unknown]>; onEdit: () => void }) {
  return (
    <div className="rounded-xl border border-[var(--stayo-border)] p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <button type="button" onClick={onEdit} className="text-xs font-medium text-[var(--stayo-forest)]">Editar</button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-xs text-[var(--stayo-ink-muted)]">{k}</dt>
            <dd className="break-words">{v === undefined || v === null || v === "" ? "—" : String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function StateCard({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children?: ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-[var(--stayo-border)] bg-[var(--stayo-surface)] px-6 py-10 text-center shadow-sm">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--stayo-bg)] text-[var(--stayo-ink-muted)]">{icon}</div>
      <h1 className="mt-4 text-lg font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--stayo-ink-muted)]">{text}</p>
      {children}
    </section>
  );
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
