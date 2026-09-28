import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Copy, Home, ListChecks, Wallet, X } from "lucide-react";
import { useState } from "react";

import propertyPhoto from "@/assets/owner-portal-property-fallback.jpg";
import { StayoLogo } from "@/components/brand/StayoLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/proprietario-prototipo")({
  head: () => ({
    meta: [
      { title: "Portal do Proprietário — protótipo de uso do imóvel | STAYO" },
      { name: "description", content: "Protótipo visual: reservar datas para uso próprio e pagar a limpeza por PIX." },
      { property: "og:title", content: "Portal do Proprietário — protótipo STAYO" },
      { property: "og:description", content: "Protótipo visual: reservar datas para uso próprio e pagar a limpeza por PIX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerPortalPrototype,
});

type Screen = "home" | "calendar" | "sent" | "approved" | "paid" | "refused" | "payments" | "track" | "property";

const SCREENS: { id: Screen; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "calendar", label: "Calendário" },
  { id: "sent", label: "Enviada" },
  { id: "approved", label: "Aprovado + PIX" },
  { id: "paid", label: "Confirmado" },
  { id: "refused", label: "Recusado" },
  { id: "payments", label: "Pagamentos" },
  { id: "track", label: "Acompanhar" },
];

// Setembro 2026 de exemplo: começa numa terça (offset 2)
const MONTH = "Setembro 2026";
const OFFSET = 2;
const DAYS = 30;
const BUSY = new Set([4, 5, 6, 10, 11, 22, 23, 24, 25, 26]);

function OwnerPortalPrototype() {
  const [screen, setScreen] = useState<Screen>("home");
  const [range, setRange] = useState<[number | null, number | null]>([null, null]);
  const [copied, setCopied] = useState(false);

  const go = (s: Screen) => {
    setScreen(s);
    if (s === "calendar") setRange([null, null]);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="stayo-owner-theme min-h-dvh bg-[var(--portal-bg)] text-[var(--portal-navy)]" style={{ ["--portal-success-soft" as string]: "color-mix(in srgb, var(--portal-success) 14%, transparent)" }}>
      <nav className="sticky top-0 z-30 border-b border-[var(--portal-border)] bg-[var(--portal-surface)]/95 backdrop-blur" aria-label="Estados do protótipo">
        <div className="hide-scrollbar mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-2">
          <span className="shrink-0 self-center text-[11px] font-semibold uppercase text-[var(--portal-muted)]">Protótipo</span>
          {SCREENS.map((s) => (
            <button key={s.id} type="button" onClick={() => { go(s.id); if (s.id !== "calendar" && s.id !== "home") setRange([15, 18]); }}
              className={cn("min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium", screen === s.id ? "border-[var(--portal-navy)] bg-[var(--portal-navy)] text-[var(--portal-surface)]" : "border-[var(--portal-border)]")}>
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto w-full max-w-5xl px-5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] md:px-8">
        <header className="mb-8 flex items-center justify-between">
          <StayoLogo variant="green" className="h-7 w-auto" />
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--portal-surface-soft)] text-sm font-semibold">J</span>
        </header>

        {screen === "home" && <HomeScreen go={go} />}
        {screen === "property" && <SubPage title="Meu imóvel" onBack={() => go("home")}><img src={propertyPhoto} alt="Vêneto A201" className="aspect-[4/3] w-full rounded-3xl object-cover" /><p className="mt-4 text-sm text-[var(--portal-muted)]">Área do imóvel — fora do escopo desta fase.</p></SubPage>}
        {screen === "calendar" && <CalendarScreen range={range} setRange={setRange} onBack={() => go("home")} onSubmit={() => go("sent")} />}
        {screen === "sent" && <StatusScreen icon="clock" title="Solicitação enviada" period status="Aguardando aprovação da STAYO" onBack={() => go("home")} action={<Button variant="outline" className="h-12 w-full rounded-2xl" onClick={() => go("track")}>Acompanhar</Button>} />}
        {screen === "approved" && <PixScreen copied={copied} onCopy={() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }} onBack={() => go("home")} />}
        {screen === "paid" && <StatusScreen icon="check" celebrate title="Pagamento confirmado" subtitle="Seu período está confirmado." period onBack={() => go("home")} action={<Button className="h-12 w-full rounded-2xl" onClick={() => go("track")}>Ver detalhes</Button>} />}
        {screen === "refused" && <StatusScreen icon="x" title="Não foi possível aprovar estas datas" subtitle="O imóvel já tem manutenção programada neste período." period onBack={() => go("home")} action={<Button className="h-12 w-full rounded-2xl" onClick={() => go("calendar")}>Escolher outras datas</Button>} />}
        {screen === "payments" && (
          <SubPage title="Pagamentos" onBack={() => go("home")}>
            <ListRow title="Taxa de limpeza" meta="15–18 set" value="R$ 250,00" status="Aguardando pagamento" tone="wait" onClick={() => go("approved")} />
            <ListRow title="Taxa de limpeza" meta="02–05 ago" value="R$ 250,00" status="Pago ✓" tone="ok" onClick={() => go("paid")} />
          </SubPage>
        )}
        {screen === "track" && (
          <SubPage title="Acompanhar" onBack={() => go("home")}>
            <ListRow title="15–18 set" meta="3 noites" status="Aguardando pagamento" tone="wait" onClick={() => go("approved")} />
            <ListRow title="02–05 ago" meta="3 noites" status="Confirmado" tone="ok" onClick={() => go("paid")} />
            <ListRow title="10–12 jul" meta="2 noites" status="Concluído" tone="muted" />
          </SubPage>
        )}
      </div>
    </main>
  );
}

function HomeScreen({ go }: { go: (s: Screen) => void }) {
  const entries = [
    { id: "property" as Screen, label: "Meu imóvel", icon: Home },
    { id: "calendar" as Screen, label: "Reservar para mim", icon: CalendarDays },
    { id: "payments" as Screen, label: "Pagamentos", icon: Wallet },
    { id: "track" as Screen, label: "Acompanhar", icon: ListChecks },
  ];
  return (
    <div className="md:grid md:grid-cols-[1.1fr_1fr] md:items-start md:gap-12">
      <div>
        <p className="text-sm text-[var(--portal-muted)]">Olá, João</p>
        <div className="relative mt-4 overflow-hidden rounded-3xl">
          <img src={propertyPhoto} alt="Vêneto A201" className="aspect-[4/3] w-full object-cover md:aspect-[5/4]" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--portal-navy)]/85 to-transparent p-5 pt-16 text-[var(--portal-surface)]">
            <h1 className="font-serif text-3xl leading-tight">Vêneto A201</h1>
            <p className="mt-1 text-sm opacity-85">Canela · RS</p>
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:mt-12">
        {entries.map((e) => (
          <button key={e.id} type="button" onClick={() => go(e.id)}
            className={cn("flex min-h-[120px] flex-col justify-between rounded-3xl border p-4 text-left transition-colors md:min-h-[150px]",
              e.id === "calendar" ? "border-[var(--portal-navy)] bg-[var(--portal-navy)] text-[var(--portal-surface)]" : "border-[var(--portal-border)] bg-[var(--portal-surface)] hover:border-[var(--portal-navy)]/30")}>
            <e.icon className="h-6 w-6" />
            <span className="text-base font-semibold leading-tight">{e.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SubPage({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl">
      <button type="button" onClick={onBack} className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-medium"><ArrowLeft className="h-4 w-4" /> Início</button>
      <h1 className="mt-2 mb-6 font-serif text-3xl">{title}</h1>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function CalendarScreen({ range, setRange, onBack, onSubmit }: { range: [number | null, number | null]; setRange: (r: [number | null, number | null]) => void; onBack: () => void; onSubmit: () => void }) {
  const [start, end] = range;
  const pick = (d: number) => {
    if (BUSY.has(d)) return;
    if (start === null || end !== null || d <= start) return setRange([d, null]);
    for (let i = start; i <= d; i++) if (BUSY.has(i)) return setRange([d, null]);
    setRange([start, d]);
  };
  const nights = start && end ? end - start : 0;
  return (
    <SubPage title="Reservar para mim" onBack={onBack}>
      <div className="rounded-3xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" aria-label="Mês anterior" className="grid h-10 w-10 place-items-center rounded-full"><ChevronLeft className="h-5 w-5" /></button>
          <p className="font-semibold">{MONTH}</p>
          <button type="button" aria-label="Próximo mês" className="grid h-10 w-10 place-items-center rounded-full"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-[var(--portal-muted)]">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <span key={i} className="py-1">{d}</span>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-y-1">
          {Array.from({ length: OFFSET }).map((_, i) => <span key={`e${i}`} />)}
          {Array.from({ length: DAYS }, (_, i) => i + 1).map((d) => {
            const busy = BUSY.has(d);
            const edge = d === start || d === end;
            const inside = start && end && d > start && d < end;
            return (
              <button key={d} type="button" disabled={busy} onClick={() => pick(d)} aria-label={busy ? `${d} — Indisponível` : `${d}`}
                className={cn("mx-auto grid h-11 w-full place-items-center text-sm",
                  busy && "cursor-not-allowed text-[var(--portal-muted)]/50 line-through",
                  inside && "bg-[var(--portal-success-soft)]",
                  edge && "rounded-full bg-[var(--portal-navy)] font-semibold text-[var(--portal-surface)]")}>
                {d}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-[var(--portal-muted)]">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--portal-navy)]" /> Selecionado</span>
          <span className="flex items-center gap-1.5"><span className="line-through">12</span> Indisponível</span>
        </div>
      </div>

      {nights > 0 ? (
        <div className="space-y-4 pt-2">
          <div className="rounded-3xl bg-[var(--portal-surface)] p-5 text-center">
            <p className="font-serif text-2xl">{start} set → {end} set</p>
            <p className="mt-1 text-sm text-[var(--portal-muted)]">{nights} {nights === 1 ? "noite" : "noites"}</p>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Observação <span className="text-[var(--portal-muted)]">(opcional)</span></span>
            <textarea rows={3} className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-3 text-sm outline-none" placeholder="Ex.: chegaremos à noite" />
          </label>
          <p className="text-xs leading-5 text-[var(--portal-muted)]">Após aprovação da STAYO, será gerada a taxa de limpeza prevista para este imóvel.</p>
          <Button className="h-14 w-full rounded-2xl text-base" onClick={onSubmit}>Solicitar datas</Button>
        </div>
      ) : (
        <p className="pt-2 text-center text-sm text-[var(--portal-muted)]">{start ? "Agora escolha a data de saída" : "Toque na data de chegada"}</p>
      )}
    </SubPage>
  );
}

function StatusScreen({ icon, title, subtitle, status, period, celebrate, action, onBack }: { icon: "clock" | "check" | "x"; title: string; subtitle?: string; status?: string; period?: boolean; celebrate?: boolean; action?: React.ReactNode; onBack: () => void }) {
  const Icon = icon === "clock" ? Clock : icon === "check" ? Check : X;
  return (
    <SubPage title="" onBack={onBack}>
      <div className="text-center">
        <div className={cn("relative mx-auto grid h-20 w-20 place-items-center rounded-full",
          icon === "x" ? "bg-[var(--portal-surface-soft)] text-[var(--portal-muted)]" : "bg-[var(--portal-success-soft)] text-[var(--portal-success)]")}>
          {celebrate && <span className="absolute inset-0 animate-ping rounded-full bg-[var(--portal-success-soft)] [animation-iteration-count:2]" />}
          <Icon className="relative h-9 w-9" />
        </div>
        <h2 className="mt-5 font-serif text-2xl">{title}{icon !== "x" ? " ✓" : ""}</h2>
        {subtitle && <p className="mt-2 text-sm text-[var(--portal-muted)]">{subtitle}</p>}
      </div>
      {period && (
        <div className="rounded-3xl bg-[var(--portal-surface)] p-5 text-center">
          <p className="font-serif text-xl">15 → 18 de setembro</p>
          <p className="mt-1 text-sm text-[var(--portal-muted)]">3 noites</p>
        </div>
      )}
      {status && <p className="flex items-center justify-center gap-2 text-sm"><span className="h-2 w-2 rounded-full bg-[var(--portal-navy)]/40" />{status}</p>}
      <div className="pt-4">{action}</div>
    </SubPage>
  );
}

function PixScreen({ copied, onCopy, onBack }: { copied: boolean; onCopy: () => void; onBack: () => void }) {
  return (
    <SubPage title="" onBack={onBack}>
      <div className="text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--portal-success-soft)] px-3 py-1 text-xs font-semibold text-[var(--portal-success)]"><Check className="h-3.5 w-3.5" /> Solicitação aprovada</p>
        <p className="mt-3 text-sm text-[var(--portal-muted)]">15 → 18 de setembro · 3 noites</p>
      </div>
      <div className="rounded-3xl bg-[var(--portal-surface)] p-5 text-center">
        <p className="text-sm text-[var(--portal-muted)]">Taxa de limpeza</p>
        <p className="mt-1 font-serif text-4xl">R$ 250,00</p>
        <p className="mt-1 text-[11px] text-[var(--portal-muted)]">Valor de exemplo</p>
        <div className="relative mx-auto mt-5 w-48">
          <DemoQr />
          <span className="absolute inset-x-0 -bottom-2 mx-auto w-fit rounded-full bg-[var(--portal-surface-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--portal-muted)]">Demonstração</span>
        </div>
        <Button variant="outline" className="mt-6 h-12 w-full rounded-2xl" onClick={onCopy}>
          {copied ? <><Check className="h-4 w-4" /> Código copiado</> : <><Copy className="h-4 w-4" /> Copiar código PIX</>}
        </Button>
      </div>
      <dl className="space-y-3 rounded-3xl border border-[var(--portal-border)] p-5 text-sm">
        <div><dt className="text-xs text-[var(--portal-muted)]">Favorecido</dt><dd className="mt-0.5 font-medium">SERRA SERV E HOSP LTDA<br /><span className="font-normal text-[var(--portal-muted)]">STAYO GRAMADO</span></dd></div>
        <div className="flex justify-between gap-4"><div><dt className="text-xs text-[var(--portal-muted)]">Banco</dt><dd className="mt-0.5 font-medium">Sicredi</dd></div>
        <div className="text-right"><dt className="text-xs text-[var(--portal-muted)]">Chave PIX / CNPJ</dt><dd className="mt-0.5 font-medium">67.217.149/0001-06</dd></div></div>
      </dl>
      <p className="flex items-center justify-center gap-2 text-sm"><Clock className="h-4 w-4 text-[var(--portal-muted)]" /> Aguardando confirmação do pagamento</p>
    </SubPage>
  );
}

function DemoQr() {
  // padrão decorativo fixo — não é um QR Code válido
  const n = 21;
  const cells = Array.from({ length: n * n }, (_, i) => {
    const x = i % n, y = Math.floor(i / n);
    const finder = (a: number, b: number) => x >= a && x < a + 7 && y >= b && y < b + 7;
    if (finder(0, 0) || finder(14, 0) || finder(0, 14)) {
      const lx = x % 14 === x ? x : x - 14, ly = y % 14 === y ? y : y - 14;
      const r = Math.max(Math.abs(lx - 3), Math.abs(ly - 3));
      return r !== 2;
    }
    return ((x * 7 + y * 13 + x * y) % 5) < 2;
  });
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="w-full rounded-xl bg-[var(--portal-surface)] p-2 ring-1 ring-[var(--portal-border)]" aria-label="QR Code de demonstração">
      {cells.map((on, i) => on && <rect key={i} x={i % n} y={Math.floor(i / n)} width="1" height="1" fill="var(--portal-navy)" />)}
    </svg>
  );
}

function ListRow({ title, meta, value, status, tone, onClick }: { title: string; meta: string; value?: string; status: string; tone: "wait" | "ok" | "muted"; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-3xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-4 text-left">
      <span className="min-w-0">
        <span className="block truncate font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-[var(--portal-muted)]">{meta}{value ? ` · ${value}` : ""}</span>
        <span className={cn("mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
          tone === "ok" ? "bg-[var(--portal-success-soft)] text-[var(--portal-success)]" : tone === "wait" ? "bg-[var(--portal-surface-soft)] text-[var(--portal-navy)]" : "text-[var(--portal-muted)]")}>{status}</span>
      </span>
      {onClick && <ChevronRight className="h-5 w-5 shrink-0 text-[var(--portal-muted)]" />}
    </button>
  );
}
