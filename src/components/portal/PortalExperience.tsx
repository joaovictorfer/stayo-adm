import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileSignature,
  FileText,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";


export function PortalBrand({ context = "Portal do proprietário" }: { context?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img src="/favicon.ico" alt="Stayo" className="h-11 w-11 shrink-0 object-contain" />
      <div className="min-w-0">
        <span className="block text-xl font-semibold leading-none text-[var(--portal-navy)]">STAYO</span>
        <span className="mt-1 block truncate text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--portal-muted)]">
          {context}
        </span>
      </div>
    </div>
  );
}

export function PortalShell({
  children,
  context,
  footer = "Você acompanha cada etapa. A Stayo cuida dos detalhes.",
  width = "wide",
  framed = true,
  showBrand = true,
}: {
  children: ReactNode;
  context?: string;
  footer?: string;
  width?: "compact" | "medium" | "wide";
  framed?: boolean;
  showBrand?: boolean;
}) {
  const widths = { compact: "max-w-md", medium: "max-w-2xl", wide: "max-w-5xl" };
  return (
    <div className="stayo-owner-theme min-h-screen bg-[var(--portal-bg)] px-4 py-5 text-[var(--portal-ink)] sm:px-7 sm:py-8">
      <div className={cn("mx-auto w-full", widths[width])}>
        {showBrand && <div className="mb-6 px-1 sm:mb-8"><PortalBrand {...(context ? { context } : {})} /></div>}
        <main className={cn(framed && "portal-shell-surface")}>{children}</main>
        <p className="mx-auto mt-6 max-w-lg text-center text-xs leading-5 text-[var(--portal-muted)]">{footer}</p>
      </div>
    </div>
  );
}

export function PortalSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="portal-card space-y-5" aria-label="Preparando suas informações" aria-busy="true">
      <div className="flex items-center gap-4">
        <div className="portal-skeleton h-11 w-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="portal-skeleton h-4 w-2/5 rounded-full" />
          <div className="portal-skeleton h-3 w-3/5 rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className={cn("portal-skeleton h-3 rounded-full", index === rows - 1 ? "w-3/4" : "w-full")} />
        ))}
      </div>
      <span className="sr-only">Só um instante, estamos preparando tudo para você.</span>
    </div>
  );
}

export function PortalEmptyState({
  icon,
  title,
  description,
  nextStep,
  action,
  positive = false,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  nextStep?: string;
  action?: { label: string; onClick: () => void };
  positive?: boolean;
}) {
  return (
    <div className="portal-empty">
      <div className={cn("portal-empty-icon", positive && "portal-empty-icon-success")}>
        {icon ?? (positive ? <CheckCircle2 /> : <Sparkles />)}
      </div>
       <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-[var(--portal-navy)]">{title}</h3>
        <p className="mt-1 max-w-lg text-sm leading-6 text-[var(--portal-muted)]">{description}</p>
         {nextStep && <p className="portal-empty-next">{nextStep}</p>}
         {action && (
           <Button type="button" onClick={action.onClick} variant="outline" size="sm" className="portal-action portal-empty-action border-[var(--portal-border)] text-[var(--portal-navy)] hover:bg-[var(--portal-surface)]">
             {action.label}<ArrowRight className="h-3.5 w-3.5" />
           </Button>
         )}
      </div>
    </div>
  );
}

const WELCOME_FLAG_KEY = "stayo-owner-welcome-seen";

export function useOwnerWelcomeState() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(WELCOME_FLAG_KEY);
      setShowWelcome(seen !== "true");
    } catch {
      setShowWelcome(true);
    }
    setReady(true);
  }, []);

  const dismiss = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(WELCOME_FLAG_KEY, "true");
    } catch {
      // ignore
    }
    setShowWelcome(false);
  };

  return { showWelcome, ready, dismiss };
}

interface OwnerWelcomeOverlayProps {
  firstName: string;
  propertyName?: string;
  onStart: () => void;
}

export function OwnerWelcomeOverlay({
  firstName,
  propertyName,
  onStart,
}: OwnerWelcomeOverlayProps) {
  const steps = [
    {
      icon: <ClipboardList aria-hidden="true" />,
      title: "Acompanhe sua implantação",
      description: "Veja em qual etapa seu imóvel está e os próximos marcos.",
    },
    {
      icon: <User aria-hidden="true" />,
      title: "Complete seus dados",
      description: "Envie informações pessoais, endereço e dados para repasse com segurança.",
    },
    {
      icon: <FileSignature aria-hidden="true" />,
      title: "Receba propostas",
      description: "Confira valores e condições comerciais no seu tempo.",
    },
    {
      icon: <FileText aria-hidden="true" />,
      title: "Acesse documentos",
      description: "Contratos, propostas e arquivos liberados pela equipe Stayo.",
    },
  ];

  const howItWorks = [
    { label: "Cadastro", text: "Você preenche seus dados e revisa a proposta." },
    { label: "Preparação", text: "A Stayo organiza a implantação do imóvel." },
    { label: "Operação", text: "Seu imóvel começa a receber hóspedes e você acompanha tudo." },
  ];

  const checklist = [
    "Identificação e contato",
    "Endereço",
    "Dados para repasse",
    "Documentos solicitados",
  ];

  return (
    <div
      className="portal-welcome-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="owner-welcome-title"
    >
      <div className="portal-welcome-card">
        <div className="portal-welcome-hero">
          <div className="portal-welcome-brand">
            <img src="/favicon.ico" alt="Stayo" className="h-10 w-10 object-contain" />
            <div>
              <span className="block text-lg font-semibold leading-none text-[var(--portal-hero-foreground)]">
                STAYO
              </span>
              <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--portal-hero-muted)]">
                Portal do proprietário
              </span>
            </div>
          </div>
          <div className="portal-welcome-hero-copy">
            <p className="portal-welcome-greeting">Olá, {firstName}.</p>
            <h1 id="owner-welcome-title" className="portal-welcome-title">
              Bem-vindo ao seu portal
            </h1>
            <p className="portal-welcome-lead">
              Este é o seu espaço exclusivo para acompanhar a preparação do imóvel
              {propertyName ? ` — ${propertyName}` : ""}. Aqui você confere etapas, envia informações e
              acessa documentos com tranquilidade.
            </p>
          </div>
        </div>

        <div className="portal-welcome-body">
          <section className="portal-welcome-features" aria-labelledby="owner-welcome-features">
            <h2 id="owner-welcome-features" className="sr-only">
              O que você pode fazer por aqui
            </h2>
            <ul>
              {steps.map((step) => (
                <li key={step.title} className="portal-welcome-feature">
                  <span className="portal-welcome-feature-icon">{step.icon}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="portal-welcome-columns">
            <section className="portal-welcome-section" aria-labelledby="owner-welcome-how">
              <h2 id="owner-welcome-how">Como funciona a implantação</h2>
              <ol className="portal-welcome-steps">
                {howItWorks.map((item, index) => (
                  <li key={item.label}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="portal-welcome-section" aria-labelledby="owner-welcome-checklist">
              <h2 id="owner-welcome-checklist">O que você precisará preencher</h2>
              <ul className="portal-welcome-checklist">
                {checklist.map((item) => (
                  <li key={item}>
                    <CheckCircle2 aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="portal-welcome-timing">
                <Clock3 aria-hidden="true" />
                <div>
                  <strong>Tempo estimado</strong>
                  <p>De 5 a 10 minutos no seu primeiro acesso.</p>
                </div>
              </div>
            </section>
          </div>

          <div className="portal-welcome-security">
            <ShieldCheck aria-hidden="true" />
            <p>
              Seus dados são tratados com segurança e só são visíveis para você e para a equipe
              autorizada da Stayo.
            </p>
          </div>
        </div>

        <div className="portal-welcome-actions">
          <Button
            type="button"
            onClick={onStart}
            className="portal-action portal-welcome-cta h-12 w-full rounded-xl bg-[var(--portal-navy)] px-7 text-[var(--portal-hero-foreground)] hover:bg-[var(--portal-navy-strong)] sm:w-auto"
          >
            Começar a acompanhar <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
