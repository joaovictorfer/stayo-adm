import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  CloudOff,
  LayoutGrid,
  Link2Off,
  Loader2,
  RotateCcw,
  Send,
  Plus,
  X,
  XOctagon,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import demoPhoto from "@/assets/vistoria-demo-sala.jpg";
import { StayoLogo } from "@/components/brand/StayoLogo";
import { CameraRun, type RunItem } from "@/components/vistoria/CameraRun";

export const Route = createFileRoute("/vistoria/prototipo/link")({
  head: () => ({
    meta: [
      { title: "Vistoria em campo (protótipo) — STAYO" },
      { name: "description", content: "Protótipo visual do link externo para executar uma vistoria em campo." },
      { property: "og:title", content: "Vistoria em campo (protótipo) — STAYO" },
      { property: "og:description", content: "Protótipo visual, sem funcionamento real, da execução de vistoria pelo celular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FieldInspectionPrototype,
});

/* ---------- Dados demonstrativos ---------- */
const CTX = { property: "Apartamento 101", kind: "Pré-check-in", code: "VST-1024", model: "Pré-check-in · v3" };
type ItemType = "photo" | "question" | "condition";
type Cond = "ok" | "atencao" | "problema";
interface Item { id: string; room: string; name: string; hint: string; type: ItemType }
const ITEMS: Item[] = [
  { id: "i1", room: "Sala", name: "Vista geral da sala", hint: "Fotografe a sala inteira a partir da porta.", type: "photo" },
  { id: "i2", room: "Sala", name: "Sofá", hint: "Fotografe o sofá de frente.", type: "photo" },
  { id: "i3", room: "Sala", name: "Estado do sofá", hint: "Avalie tecido, almofadas e manchas.", type: "condition" },
  { id: "i4", room: "Sala", name: "A TV liga normalmente?", hint: "Ligue a TV e confira imagem e som.", type: "question" },
  { id: "i5", room: "Cozinha", name: "Bancada e pia", hint: "Fotografe a bancada limpa e seca.", type: "photo" },
  { id: "i6", room: "Cozinha", name: "Geladeira ligada?", hint: "Abra e confira se está gelando.", type: "question" },
  { id: "i7", room: "Cozinha", name: "Estado do fogão", hint: "Confira bocas e acendimento.", type: "condition" },
  { id: "i8", room: "Quarto", name: "Cama arrumada", hint: "Fotografe a cama de frente.", type: "photo" },
  { id: "i9", room: "Quarto", name: "Estado do enxoval", hint: "Lençóis e toalhas sem manchas.", type: "condition" },
  { id: "i10", room: "Banheiro", name: "Box e chuveiro", hint: "Fotografe o box aberto.", type: "photo" },
  { id: "i11", room: "Banheiro", name: "Água quente funciona?", hint: "Abra o chuveiro por alguns segundos.", type: "question" },
  { id: "i12", room: "Área externa", name: "Sacada", hint: "Fotografe a sacada inteira.", type: "photo" },
];
/* Snapshot demonstrativo do roteiro de câmera (28 itens). */
const RUN_ITEMS: RunItem[] = [
  { id: "c1", room: "Cozinha", name: "Geladeira fechada", ref: { photo: demoPhoto, description: "Geladeira inox duas portas, fotografada de frente com as portas fechadas.", quantity: 1, brand: "Brastemp", condition: "Bom", note: "Conferir borracha da porta." } },
  { id: "c2", room: "Cozinha", name: "Fogão", ref: { description: "Cooktop 4 bocas.", quantity: 1, condition: "Bom" } },
  { id: "c3", room: "Cozinha", name: "Bancada e pia", ref: { description: "Bancada limpa e seca." } },
  ...Array.from({ length: 25 }, (_, i) => ({
    id: `c${i + 4}`,
    room: ["Sala", "Quarto", "Banheiro", "Área externa"][i % 4]!,
    name: `Item ${i + 4}`,
    ref: {},
  })),
];
const ROOMS = [...new Set(ITEMS.map((i) => i.room))];

interface Answer { done: boolean; skipped?: boolean; photos: number; value?: string; cond?: Cond }
type Answers = Record<string, Answer>;
const RESUMED: Answers = {
  i1: { done: true, photos: 1 },
  i2: { done: false, skipped: true, photos: 0 },
  i5: { done: true, photos: 2 },
  i6: { done: true, photos: 0, value: "Sim" },
  i7: { done: true, photos: 1, cond: "atencao" },
};

type LinkState = "pronto" | "andamento" | "offline" | "expirado" | "enviado" | "reaberto";
const STATES: { v: LinkState; l: string }[] = [
  { v: "pronto", l: "Pronto" },
  { v: "andamento", l: "Em andamento" },
  { v: "offline", l: "Sem conexão" },
  { v: "expirado", l: "Expirado" },
  { v: "enviado", l: "Enviado" },
  { v: "reaberto", l: "Reaberto" },
];
type Screen = "execucao" | "inicio" | "item" | "camera" | "previa" | "ambientes" | "revisao" | "final";
type Save = "salvo" | "salvando" | "offline";

const COND: Record<Cond, { label: string; icon: typeof Check; cls: string }> = {
  ok: { label: "OK", icon: CheckCircle2, cls: "border-primary bg-primary/10 text-foreground" },
  atencao: { label: "Atenção", icon: AlertTriangle, cls: "border-amber-600 bg-amber-500/15 text-foreground" },
  problema: { label: "Problema", icon: XOctagon, cls: "border-destructive bg-destructive/10 text-foreground" },
};

function FieldInspectionPrototype() {
  const [linkState, setLinkState] = useState<LinkState>("pronto");
  const [screen, setScreen] = useState<Screen>("inicio");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [save, setSave] = useState<Save>("salvo");
  const [qa, setQa] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setQa(q.get("controles") === "1");
    const e = q.get("estado") as LinkState | null;
    if (e && STATES.some((x) => x.v === e)) applyState(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyState = (s: LinkState) => {
    setLinkState(s);
    if (s === "pronto") { setAnswers({}); setIdx(0); setScreen("inicio"); setSave("salvo"); }
    if (s === "andamento") { setAnswers(RESUMED); setIdx(2); setScreen("inicio"); setSave("salvo"); }
    if (s === "offline") { setAnswers(RESUMED); setIdx(2); setScreen("item"); setSave("offline"); }
    if (s === "enviado") setScreen("final");
    if (s === "reaberto") { setAnswers({ ...RESUMED, i7: { done: false, photos: 1, cond: "atencao" } }); setIdx(6); setScreen("inicio"); setSave("salvo"); }
  };

  const touch = () => {
    if (save === "offline") return;
    setSave("salvando");
    window.setTimeout(() => setSave("salvo"), 700);
  };
  const update = (id: string, a: Partial<Answer>) => {
    setAnswers((s) => ({ ...s, [id]: { done: false, photos: 0, ...s[id], ...a } }));
    touch();
  };
  const item = ITEMS[idx]!;
  const cur = answers[item.id];
  const go = (n: number) => {
    if (n >= ITEMS.length) return setScreen("revisao");
    setIdx(Math.max(0, n));
    setScreen("item");
  };
  const skip = () => { update(item.id, { skipped: true, done: false }); go(idx + 1); };

  const doneCount = ITEMS.filter((i) => answers[i.id]?.done).length;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-muted/40">
      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background shadow-sm md:my-6 md:min-h-[780px] md:overflow-hidden md:rounded-3xl md:border md:border-border">
        {linkState === "expirado" ? (
          <Expired />
        ) : screen === "execucao" ? (
          <CameraRun items={RUN_ITEMS} context={{ inspectionId: CTX.code, inspectionKind: CTX.kind, inspectionStatus: "Em andamento", property: CTX.property, author: "Vistoriador do link", guest: { firstName: "Mariana", lastName: "Souza" } }} onExit={() => setScreen("inicio")} />
        ) : screen === "inicio" ? (
          <Start
            reopened={linkState === "reaberto"}
            progress={doneCount}
            hasProgress={Object.keys(answers).length > 0}
            onStart={() => setScreen("execucao")}
            onResume={() => go(idx)}
          />
        ) : screen === "item" ? (
          <ItemScreen
            item={item} idx={idx} answer={cur} save={save}
            onPhoto={() => setScreen("camera")}
            onValue={(v) => update(item.id, { value: v, done: true, skipped: false })}
            onCond={(c) => update(item.id, { cond: c, done: c === "ok" || (cur?.photos ?? 0) > 0, skipped: false })}
            onSkip={skip}
            onPrev={() => go(idx - 1)}
            onNext={() => go(idx + 1)}
            onRooms={() => setScreen("ambientes")}
          />
        ) : screen === "camera" ? (
          <CameraScreen item={item} onClose={() => setScreen("item")} onCapture={() => setScreen("previa")} />
        ) : screen === "previa" ? (
          <Preview
            item={item}
            onUse={() => { update(item.id, { photos: (cur?.photos ?? 0) + 1, done: item.type === "photo" || !!cur?.cond, skipped: false }); setScreen("item"); }}
            onRetake={() => setScreen("camera")}
            onAnother={() => { update(item.id, { photos: (cur?.photos ?? 0) + 1 }); setScreen("camera"); }}
          />
        ) : screen === "ambientes" ? (
          <Rooms answers={answers} onClose={() => setScreen("item")} onOpen={(i) => go(i)} onReview={() => setScreen("revisao")} />
        ) : screen === "revisao" ? (
          <Review answers={answers} onPending={() => setScreen("ambientes")} onSend={() => { setLinkState("enviado"); setScreen("final"); }} />
        ) : (
          <Final />
        )}
      </main>
      {qa && (
        <aside aria-label="Controles de protótipo" className="mx-auto mt-6 w-full max-w-md border-t-2 border-dashed border-border px-4 py-4 text-xs text-muted-foreground">
          <p className="mb-2 font-semibold uppercase tracking-wide">Controles de protótipo · fora da experiência</p>
          <select aria-label="Estado do link" value={linkState} onChange={(e) => applyState(e.target.value as LinkState)} className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground">
            {STATES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </aside>
      )}
    </div>
  );
}

function ProtoBadge() {
  return <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Protótipo visual</span>;
}

function Start({ reopened, progress, hasProgress, onStart, onResume }: { reopened: boolean; progress: number; hasProgress: boolean; onStart: () => void; onResume: () => void }) {
  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-6">
      <div className="flex items-center justify-between">
        <StayoLogo className="h-8 w-auto" />
        <ProtoBadge />
      </div>
      <div className="mt-auto space-y-5 pt-10">
        {reopened && (
          <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-600 bg-amber-500/10 p-3 text-sm">
            <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span><strong>Reaberta para correção.</strong> Revise o item indicado e envie novamente.</span>
          </p>
        )}
        <div>
          <p className="text-sm font-medium text-muted-foreground">Vistoria {CTX.kind}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{CTX.property}</h1>
        </div>
        <div>
          <div className="mb-1.5 flex justify-between text-sm"><span className="text-muted-foreground">Progresso</span><span className="tabular-nums font-medium">{progress} de {ITEMS.length}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(progress / ITEMS.length) * 100}%` }} /></div>
        </div>
        <p className="text-base text-muted-foreground">Registre os itens desta vistoria. Você pode pausar e continuar depois.</p>
        <div className="space-y-3 pt-2">
          {hasProgress ? (
            <>
              <button onClick={onResume} className="h-14 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground">Continuar de onde parei</button>
              <button onClick={onStart} className="h-12 w-full rounded-2xl border border-border text-base font-medium">Começar do primeiro item</button>
            </>
          ) : (
            <button onClick={onStart} className="h-14 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground">Iniciar vistoria</button>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveStatus({ s }: { s: Save }) {
  if (s === "salvando") return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Salvando…</span>;
  if (s === "offline") return <span className="flex items-center gap-1 text-xs font-medium text-foreground"><CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Sem conexão</span>;
  return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" aria-hidden="true" />Salvo agora</span>;
}

function ItemScreen({ item, idx, answer, save, onPhoto, onValue, onCond, onSkip, onPrev, onNext, onRooms }: {
  item: Item; idx: number; answer?: Answer | undefined; save: Save;
  onPhoto: () => void; onValue: (v: string) => void; onCond: (c: Cond) => void; onSkip: () => void; onPrev: () => void; onNext: () => void; onRooms: () => void;
}) {
  const needPhoto = item.type === "condition" && (answer?.cond === "atencao" || answer?.cond === "problema");
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <p className="truncate text-base font-semibold">{item.room}</p>
          <SaveStatus s={save} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${((idx + 1) / ITEMS.length) * 100}%` }} /></div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{idx + 1} de {ITEMS.length}</span>
        </div>
        {save === "offline" && <p className="mt-2 rounded-lg bg-muted px-2 py-1.5 text-xs">Sem conexão — alterações aguardando envio.</p>}
      </header>

      <div className="flex flex-1 flex-col px-5 py-6">
        {answer?.skipped && !answer.done && (
          <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"><CircleSlash className="h-3 w-3" aria-hidden="true" />Pulado · pendente</span>
        )}
        <h2 className="text-2xl font-semibold leading-tight">{item.name}</h2>
        <p className="mt-2 text-base text-muted-foreground">{item.hint}</p>

        <div className="mt-6 space-y-3">
          {item.type === "photo" && (
            <button onClick={onPhoto} className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground">
              <Camera className="h-10 w-10" aria-hidden="true" />
              <span className="text-lg font-semibold">{answer?.photos ? `Tirar outra foto (${answer.photos})` : "Tirar foto"}</span>
            </button>
          )}
          {item.type === "question" && (
            <div className="grid gap-2">
              {["Sim", "Não", "Não se aplica"].map((v) => (
                <button key={v} aria-pressed={answer?.value === v} onClick={() => onValue(v)} className={`flex h-14 items-center justify-between rounded-2xl border-2 px-4 text-base font-medium ${answer?.value === v ? "border-primary bg-primary/10" : "border-border"}`}>
                  {v}{answer?.value === v && <Check className="h-5 w-5" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
          {item.type === "condition" && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(COND) as Cond[]).map((c) => {
                  const C = COND[c];
                  const on = answer?.cond === c;
                  return (
                    <button key={c} aria-pressed={on} onClick={() => onCond(c)} className={`flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 text-sm font-semibold ${on ? C.cls : "border-border"}`}>
                      <C.icon className="h-6 w-6" aria-hidden="true" />{C.label}
                    </button>
                  );
                })}
              </div>
              {needPhoto && (
                <div className="rounded-2xl border border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium"><Camera className="h-4 w-4 shrink-0" aria-hidden="true" />Foto obrigatória para registrar esta condição.</p>
                  <button onClick={onPhoto} className="mt-3 h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground">{answer?.photos ? `Foto registrada (${answer.photos}) · tirar outra` : "Tirar foto"}</button>
                </div>
              )}
            </>
          )}
        </div>

        <button onClick={onSkip} className="mt-auto pt-6 text-center text-base font-medium text-muted-foreground underline underline-offset-4">Pular por enquanto</button>
      </div>

      <footer className="sticky bottom-0 grid grid-cols-3 gap-2 border-t border-border bg-background p-3">
        <button onClick={onRooms} className="flex h-12 items-center justify-center gap-1 rounded-xl border border-border text-sm font-medium"><LayoutGrid className="h-4 w-4" aria-hidden="true" />Ambientes</button>
        <button onClick={onPrev} disabled={idx === 0} className="flex h-12 items-center justify-center gap-1 rounded-xl border border-border text-sm font-medium disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Anterior</button>
        <button onClick={onNext} className="flex h-12 items-center justify-center gap-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground">Próximo<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
      </footer>
    </div>
  );
}

function CameraScreen({ item, onClose, onCapture }: { item: Item; onClose: () => void; onCapture: () => void }) {
  const [flash, setFlash] = useState(false);
  return (
    <div className="relative flex flex-1 flex-col bg-foreground text-background">
      <div className="flex items-center justify-between gap-3 p-4">
        <button onClick={onClose} aria-label="Fechar câmera" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-background/15"><X className="h-6 w-6" /></button>
        <div className="min-w-0 text-center">
          <p className="truncate text-xs opacity-70">{item.room}</p>
          <p className="truncate text-sm font-semibold">{item.name}</p>
        </div>
        <button onClick={() => setFlash((f) => !f)} aria-pressed={flash} aria-label="Lanterna" className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${flash ? "bg-background text-foreground" : "bg-background/15"}`}><Zap className="h-5 w-5" /></button>
      </div>
      <div className="relative mx-4 flex-1 rounded-2xl border border-background/20">
        <div className="absolute inset-8 rounded-xl border-2 border-dashed border-background/40" />
        <p className="absolute inset-x-0 bottom-4 text-center text-sm opacity-80">Simulação de câmera · protótipo</p>
      </div>
      <p className="px-6 pt-4 text-center text-base">{item.hint}</p>
      <div className="flex justify-center p-6">
        <button onClick={onCapture} aria-label="Capturar foto" className="grid h-20 w-20 place-items-center rounded-full border-4 border-background"><span className="h-16 w-16 rounded-full bg-background" /></button>
      </div>
    </div>
  );
}

function Preview({ item, onUse, onRetake, onAnother }: { item: Item; onUse: () => void; onRetake: () => void; onAnother: () => void }) {
  return (
    <div className="flex flex-1 flex-col bg-foreground text-background">
      <p className="p-4 text-center text-sm font-semibold">{item.room} · {item.name}</p>
      <div className="relative mx-4 overflow-hidden rounded-2xl">
        <img src={demoPhoto} alt="Foto demonstrativa da sala" width={768} height={1024} className="block h-auto w-full" />
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-foreground/60 px-3 py-2 text-[11px] leading-tight text-background">
          <StayoLogo variant="white" decorative className="h-4 w-auto shrink-0" />
          <span className="min-w-0">26/09/2026 14:32 · {CTX.property} · {CTX.kind} · {CTX.code}</span>
        </div>
      </div>
      <p className="px-6 pt-3 text-center text-xs opacity-70">Na versão integrada, a marca-d’água será gravada no arquivo antes do armazenamento.</p>
      <div className="mt-auto grid grid-cols-2 gap-2 p-4">
        <button onClick={onRetake} className="flex h-12 items-center justify-center gap-1 rounded-xl bg-background/15 font-medium"><RotateCcw className="h-4 w-4" aria-hidden="true" />Refazer</button>
        <button onClick={onAnother} className="flex h-12 items-center justify-center gap-1 rounded-xl bg-background/15 font-medium"><Plus className="h-4 w-4" aria-hidden="true" />Adicionar outra</button>
        <button onClick={onUse} className="col-span-2 h-14 rounded-xl bg-background text-base font-semibold text-foreground">Usar foto</button>
      </div>
    </div>
  );
}

function roomStats(room: string, answers: Answers) {
  const items = ITEMS.filter((i) => i.room === room);
  const a = items.map((i) => answers[i.id]);
  return {
    total: items.length,
    done: a.filter((x) => x?.done).length,
    atencao: a.filter((x) => x?.cond === "atencao").length,
    problema: a.filter((x) => x?.cond === "problema").length,
    photos: a.reduce((s, x) => s + (x?.photos ?? 0), 0),
    first: ITEMS.findIndex((i) => i.room === room && !answers[i.id]?.done),
    start: ITEMS.findIndex((i) => i.room === room),
  };
}

function Rooms({ answers, onClose, onOpen, onReview }: { answers: Answers; onClose: () => void; onOpen: (i: number) => void; onReview: () => void }) {
  const skipped = ITEMS.map((it, i) => ({ it, i })).filter(({ it }) => answers[it.id]?.skipped && !answers[it.id]?.done);
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border p-4">
        <button onClick={onClose} aria-label="Voltar" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border"><ChevronLeft className="h-5 w-5" /></button>
        <h2 className="text-lg font-semibold">Ambientes</h2>
      </header>
      <div className="flex-1 space-y-3 p-4">
        {skipped.length > 0 && (
          <div className="rounded-2xl border border-border p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><CircleSlash className="h-4 w-4" aria-hidden="true" />Itens pulados</p>
            {skipped.map(({ it, i }) => (
              <button key={it.id} onClick={() => onOpen(i)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm">
                <span className="min-w-0 truncate">{it.room} · {it.name}</span><ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        {ROOMS.map((r) => {
          const s = roomStats(r, answers);
          const complete = s.done === s.total;
          return (
            <button key={r} onClick={() => onOpen(s.first >= 0 ? s.first : s.start)} className="flex w-full items-center gap-3 rounded-2xl border border-border p-4 text-left">
              {complete ? <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" /> : <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-muted-foreground text-[10px] font-bold">{s.total - s.done}</span>}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{r}</span>
                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{complete ? "Concluído" : `${s.total - s.done} pendente${s.total - s.done > 1 ? "s" : ""}`}</span>
                  {s.atencao > 0 && <span className="flex items-center gap-0.5 font-medium text-foreground"><AlertTriangle className="h-3 w-3" aria-hidden="true" />{s.atencao} atenção</span>}
                  {s.problema > 0 && <span className="flex items-center gap-0.5 font-medium text-foreground"><XOctagon className="h-3 w-3" aria-hidden="true" />{s.problema} problema</span>}
                  <span className="flex items-center gap-0.5"><Camera className="h-3 w-3" aria-hidden="true" />{s.photos}</span>
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="sticky bottom-0 border-t border-border bg-background p-3">
        <button onClick={onReview} className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground">Ir para revisão e envio</button>
      </div>
    </div>
  );
}

function Review({ answers, onPending, onSend }: { answers: Answers; onPending: () => void; onSend: () => void }) {
  const a = ITEMS.map((i) => answers[i.id]);
  const stats = [
    { l: "Concluídos", v: a.filter((x) => x?.done).length, icon: CheckCircle2 },
    { l: "Pulados ou pendentes", v: a.filter((x) => !x?.done).length, icon: CircleSlash },
    { l: "Com atenção", v: a.filter((x) => x?.cond === "atencao").length, icon: AlertTriangle },
    { l: "Com problema", v: a.filter((x) => x?.cond === "problema").length, icon: XOctagon },
    { l: "Fotos registradas", v: a.reduce((s, x) => s + (x?.photos ?? 0), 0), icon: Camera },
  ];
  const pending = stats[1]!.v > 0;
  return (
    <div className="flex flex-1 flex-col px-5 py-6">
      <h2 className="text-2xl font-semibold">Revisão</h2>
      <p className="mt-1 text-sm text-muted-foreground">{CTX.property} · {CTX.kind}</p>
      <ul className="mt-5 divide-y divide-border rounded-2xl border border-border">
        {stats.map((s) => (
          <li key={s.l} className="flex items-center gap-3 px-4 py-3"><s.icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="flex-1 text-sm">{s.l}</span><span className="text-lg font-semibold tabular-nums">{s.v}</span></li>
        ))}
      </ul>
      {pending && <p role="status" className="mt-4 rounded-2xl bg-muted p-3 text-sm">Existem itens pendentes. Você pode voltar agora ou enviar para revisão com pendências.</p>}
      <div className="mt-auto space-y-3 pt-6">
        {pending && <button onClick={onPending} className="h-12 w-full rounded-2xl border border-border font-medium">Revisar pendências</button>}
        <button onClick={onSend} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground"><Send className="h-5 w-5" aria-hidden="true" />Enviar para revisão</button>
      </div>
    </div>
  );
}

function Final() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <CheckCircle2 className="h-16 w-16 text-primary" aria-hidden="true" />
      <h2 className="text-2xl font-semibold">Vistoria enviada para revisão.</h2>
      <p className="text-sm text-muted-foreground">26/09/2026 às 14:58 · {CTX.property}</p>
      <p className="text-base text-muted-foreground">Caso seja reaberta, você receberá acesso novamente.</p>
      <StayoLogo className="mt-6 h-7 w-auto" />
      <ProtoBadge />
    </div>
  );
}

function Expired() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <Link2Off className="h-14 w-14 text-muted-foreground" aria-hidden="true" />
      <h2 className="text-2xl font-semibold">Este link não está mais disponível</h2>
      <p className="text-base text-muted-foreground">Ele expirou ou foi cancelado. Peça um novo link a quem enviou esta vistoria.</p>
      <StayoLogo className="mt-6 h-7 w-auto" />
      <ProtoBadge />
    </div>
  );
}
