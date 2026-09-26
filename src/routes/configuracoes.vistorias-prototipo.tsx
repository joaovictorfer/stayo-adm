import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Eye,
  History,
  Home,
  Layers,
  ListChecks,
  Lock,
  Pencil,
  Plus,
  Type,
} from "lucide-react";
import { useState } from "react";

import { AdminPageHeader, AdminSection, AdminStatusBadge, type AdminTone } from "@/components/admin/AdminPrimitives";

export const Route = createFileRoute("/configuracoes/vistorias-prototipo")({
  head: () => ({
    meta: [
      { title: "Configurar vistorias (protótipo) — Stayo Admin" },
      { name: "description", content: "Protótipo visual de modelos, ambientes e itens de vistoria." },
      { property: "og:title", content: "Configurar vistorias (protótipo) — Stayo Admin" },
      { property: "og:description", content: "Modelos versionados, biblioteca de ambientes e prévia de campo, sem persistência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InspectionConfigPrototype,
});

/* ---------- Dados demonstrativos em memória ---------- */
type Answer = "foto_obrig" | "foto_opc" | "sim_nao" | "condicao" | "texto" | "condicao_foto";
const ANSWER: Record<Answer, { label: string; kind: "Foto" | "Pergunta" | "Condição"; icon: typeof Camera; photo: string }> = {
  foto_obrig: { label: "Foto obrigatória", kind: "Foto", icon: Camera, photo: "Sempre exige foto" },
  foto_opc: { label: "Foto opcional", kind: "Foto", icon: Camera, photo: "Foto se quiser" },
  sim_nao: { label: "Sim ou Não", kind: "Pergunta", icon: CheckCircle2, photo: "Sem foto" },
  condicao: { label: "Condição: OK, Atenção ou Problema", kind: "Condição", icon: CircleDot, photo: "Sem foto" },
  texto: { label: "Texto curto", kind: "Pergunta", icon: Type, photo: "Sem foto" },
  condicao_foto: { label: "Condição com foto em Atenção ou Problema", kind: "Condição", icon: CircleDot, photo: "Foto se Atenção ou Problema" },
};

interface Item { title: string; hint: string; answer: Answer; required: boolean }
interface Room { name: string; required: boolean; active: boolean; items: Item[] }
type ModelStatus = "ativo" | "edicao" | "arquivado";
interface Model {
  id: string;
  name: string;
  trigger: string;
  version: string;
  status: ModelStatus;
  updated: string;
  versions: { v: string; note: string; tone: AdminTone }[];
  rooms: Room[];
}

const LIB = ["Entrada", "Sala", "Cozinha", "Quarto", "Banheiro", "Lavabo", "Varanda", "Área de serviço", "Área externa", "Experiência STAYO"];

const preRooms: Room[] = [
  { name: "Entrada", required: true, active: true, items: [
    { title: "Porta e fechadura", hint: "Abra e feche a porta uma vez.", answer: "condicao_foto", required: true },
    { title: "Foto da entrada", hint: "Enquadre a porta inteira.", answer: "foto_obrig", required: true },
  ] },
  { name: "Sala", required: true, active: true, items: [
    { title: "Visão geral da sala", hint: "Foto do canto da porta.", answer: "foto_obrig", required: true },
    { title: "Sofá e almofadas", hint: "Sem manchas ou objetos esquecidos.", answer: "condicao_foto", required: true },
    { title: "Controle da TV funciona?", hint: "Ligue e desligue a TV.", answer: "sim_nao", required: false },
  ] },
  { name: "Cozinha", required: true, active: true, items: [
    { title: "Pia e bancada", hint: "Limpas e secas.", answer: "condicao_foto", required: true },
    { title: "Geladeira vazia", hint: "Abra e confira as prateleiras.", answer: "sim_nao", required: true },
    { title: "Louças", hint: "Foto do armário aberto.", answer: "foto_opc", required: false },
  ] },
  { name: "Quarto", required: true, active: true, items: [
    { title: "Cama arrumada", hint: "Enxoval completo e esticado.", answer: "foto_obrig", required: true },
    { title: "Observação do quarto", hint: "Algo diferente do normal?", answer: "texto", required: false },
  ] },
  { name: "Banheiro", required: true, active: true, items: [
    { title: "Box e ralo", hint: "Sem cabelos ou água parada.", answer: "condicao_foto", required: true },
    { title: "Toalhas", hint: "Quantidade conforme a ocupação.", answer: "condicao", required: true },
  ] },
  { name: "Varanda", required: false, active: true, items: [
    { title: "Piso e móveis", hint: "Varrido e organizado.", answer: "condicao", required: false },
  ] },
  { name: "Experiência STAYO", required: false, active: false, items: [
    { title: "Kit de boas-vindas", hint: "Foto do kit sobre a mesa.", answer: "foto_obrig", required: true },
  ] },
];

const MODELS: Model[] = [
  { id: "pre", name: "Pré-check-in", trigger: "Reserva: pré-check-in", version: "v3", status: "ativo", updated: "12 set, 10h (demonstrativo)",
    versions: [
      { v: "v4", note: "Nova versão em edição", tone: "info" },
      { v: "v3", note: "Ativa — usada nas próximas vistorias", tone: "success" },
      { v: "v2", note: "Preservada para vistorias anteriores", tone: "neutral" },
    ], rooms: preRooms },
  { id: "pos", name: "Pós-check-out", trigger: "Reserva: pós-check-out", version: "v2", status: "ativo", updated: "08 set, 15h (demonstrativo)",
    versions: [{ v: "v2", note: "Ativa", tone: "success" }, { v: "v1", note: "Preservada para vistorias anteriores", tone: "neutral" }], rooms: preRooms.slice(0, 5) },
  { id: "imp", name: "Implantação", trigger: "Manual: implantação", version: "v1", status: "edicao", updated: "Hoje, 09h (demonstrativo)",
    versions: [{ v: "v1", note: "Em edição — ainda não usada", tone: "info" }], rooms: preRooms },
  { id: "extra", name: "Vistoria extra", trigger: "Manual: vistoria extra", version: "v1", status: "ativo", updated: "02 set (demonstrativo)",
    versions: [{ v: "v1", note: "Ativa", tone: "success" }], rooms: preRooms.slice(1, 3) },
  { id: "man", name: "Manutenção", trigger: "Manual: manutenção", version: "v2", status: "ativo", updated: "28 ago (demonstrativo)",
    versions: [{ v: "v2", note: "Ativa", tone: "success" }], rooms: preRooms.slice(3, 5) },
  { id: "rot", name: "Rotina", trigger: "Recorrente: rotina", version: "v1", status: "arquivado", updated: "10 jul (demonstrativo)",
    versions: [{ v: "v1", note: "Arquivado — preservado para consulta", tone: "neutral" }], rooms: preRooms.slice(0, 4) },
];

const STATUS: Record<ModelStatus, { label: string; tone: AdminTone }> = {
  ativo: { label: "Ativo", tone: "success" },
  edicao: { label: "Em edição", tone: "info" },
  arquivado: { label: "Arquivado", tone: "neutral" },
};

const count = (m: Model) => ({ rooms: m.rooms.length, items: m.rooms.reduce((s, r) => s + r.items.length, 0) });

const card = "rounded-[var(--radius-card)] border border-[var(--admin-border)] bg-[var(--admin-surface)]";
const muted = "text-[var(--admin-muted)]";

function InspectionConfigPrototype() {
  const [modelId, setModelId] = useState("pre");
  const [roomIdx, setRoomIdx] = useState(1);
  const [itemIdx, setItemIdx] = useState(0);
  const [mobileTab, setMobileTab] = useState<"editor" | "previa">("editor");
  const model = MODELS.find((m) => m.id === modelId)!;
  const room = model.rooms[Math.min(roomIdx, model.rooms.length - 1)]!;
  const item = room.items[Math.min(itemIdx, room.items.length - 1)]!;

  return (
    <div className="min-w-0">
      <AdminPageHeader
        eyebrow="Configurações"
        title="Vistorias"
        description="Defina uma vez os ambientes e itens de cada modelo. Cada vistoria gerada usa a versão ativa do modelo."
        meta={<AdminStatusBadge tone="warning">Protótipo visual — sem persistência</AdminStatusBadge>}
      />

      {/* 1. Modelos */}
      <AdminSection
        title="Modelos"
        description="Ao gerar uma vistoria, ela guarda a versão do modelo usada."
        action={<button type="button" onClick={() => undefined} className="inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-[var(--radius-control)] bg-[var(--admin-primary)] px-3 text-sm text-[var(--admin-primary-foreground,white)]"><Plus size={16} /> Criar modelo</button>}
      >
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {MODELS.map((m) => {
            const c = count(m);
            const sel = m.id === modelId;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => { setModelId(m.id); setRoomIdx(0); setItemIdx(0); }}
                  aria-pressed={sel}
                  className={`${card} w-full p-3 text-left ${sel ? "ring-2 ring-[var(--admin-primary)]" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{m.name} · {m.version}</span>
                    <AdminStatusBadge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</AdminStatusBadge>
                  </div>
                  <p className={`mt-1 text-sm ${muted}`}>{m.trigger}</p>
                  <p className={`mt-1 text-xs ${muted}`}>{c.rooms} ambientes · {c.items} itens · {m.updated}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </AdminSection>

      {/* Abas mobile */}
      <div className="mt-4 grid grid-cols-2 gap-1 lg:hidden" role="tablist">
        {(["editor", "previa"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={mobileTab === t} type="button" onClick={() => setMobileTab(t)}
            className={`min-h-11 rounded-[var(--radius-control)] border text-sm ${mobileTab === t ? "border-[var(--admin-primary)] font-semibold" : "border-[var(--admin-border)] " + muted}`}>
            {t === "editor" ? "Editor do modelo" : "Prévia de campo"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* 2. Editor */}
        <div className={`${mobileTab === "editor" ? "" : "hidden"} min-w-0 space-y-4 lg:block`}>
          <section className={`${card} p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-xs ${muted}`}>Editor do modelo</p>
                <h2 className="text-lg font-semibold">{model.name}</h2>
                <p className={`text-sm ${muted}`}>Gatilho: {model.trigger}</p>
              </div>
              <AdminStatusBadge tone={STATUS[model.status].tone}>{model.name} · {model.version} {model.status === "ativo" ? "ativa" : STATUS[model.status].label.toLowerCase()}</AdminStatusBadge>
            </div>
            <ul className="mt-3 space-y-1.5">
              {model.versions.map((v) => (
                <li key={v.v} className="flex flex-wrap items-center gap-2 text-sm">
                  <History size={14} className={muted} />
                  <AdminStatusBadge tone={v.tone}>{v.v}</AdminStatusBadge>
                  <span>{v.note}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex gap-2 rounded-[var(--radius-control)] bg-[var(--admin-surface-muted,rgba(0,0,0,0.04))] p-2 text-sm">
              <Lock size={16} className="mt-0.5 shrink-0" />
              <span>Modelo publicado é uma cópia fixa. Mudanças relevantes geram nova versão; vistorias iniciadas ou concluídas mantêm a versão original.</span>
            </p>
          </section>

          <section className={`${card} p-4`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Ambientes do modelo</h3>
              <span className={`text-xs ${muted}`}>Ordem visual · setas apenas demonstrativas</span>
            </div>
            <ol className="space-y-1.5">
              {model.rooms.map((r, i) => (
                <li key={r.name + i}>
                  <div className={`flex flex-col gap-1 rounded-[var(--radius-control)] border p-2 sm:flex-row sm:items-center sm:gap-2 ${i === roomIdx ? "border-[var(--admin-primary)]" : "border-[var(--admin-border)]"} ${r.active ? "" : "opacity-70"}`}>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="flex flex-col"><ArrowUp size={14} className={muted} /><ArrowDown size={14} className={muted} /></span>
                      <span className="w-5 text-center text-xs">{i + 1}</span>
                      <span className="min-w-0 flex-1 font-medium">{r.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-9 sm:pl-0">
                      <AdminStatusBadge tone={r.required ? "info" : "neutral"}>{r.required ? "Obrigatório" : "Opcional"}</AdminStatusBadge>
                      <span className={`text-xs ${muted}`}>{r.items.length} itens</span>
                      <AdminStatusBadge tone={r.active ? "success" : "neutral"}>{r.active ? "Ativo" : "Inativo"}</AdminStatusBadge>
                      <button type="button" onClick={() => { setRoomIdx(i); setItemIdx(0); }} className="ml-auto inline-flex min-h-11 items-center gap-1 px-2 text-sm underline">
                        <Pencil size={14} /> Editar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className={`${card} p-4`}>
            <h3 className="font-semibold">Itens · {room.name}</h3>
            <p className={`mb-2 text-sm ${muted}`}>Toque em um item para ver na prévia.</p>
            <ol className="space-y-2">
              {room.items.map((it, i) => {
                const a = ANSWER[it.answer];
                return (
                  <li key={it.title}>
                    <button type="button" onClick={() => setItemIdx(i)} className={`w-full rounded-[var(--radius-control)] border p-3 text-left ${i === itemIdx ? "border-[var(--admin-primary)]" : "border-[var(--admin-border)]"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs ${muted}`}>#{i + 1}</span>
                        <a.icon size={16} />
                        <span className="min-w-0 flex-1 font-medium">{it.title}</span>
                        <AdminStatusBadge tone={a.kind === "Foto" ? "info" : a.kind === "Condição" ? "warning" : "neutral"}>{a.kind}</AdminStatusBadge>
                      </div>
                      <p className={`mt-1 text-sm ${muted}`}>{it.hint}</p>
                      <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                        <div><dt className={muted}>Resposta</dt><dd>{a.label}</dd></div>
                        <div><dt className={muted}>Obrigatoriedade</dt><dd>{it.required ? "Obrigatório" : "Opcional"}</dd></div>
                        <div><dt className={muted}>Regra de foto</dt><dd>{a.photo}</dd></div>
                      </dl>
                    </button>
                  </li>
                );
              })}
            </ol>
            <button type="button" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm underline"><Plus size={14} /> Adicionar item (demonstrativo)</button>
          </section>

          <section className={`${card} p-4`}>
            <h3 className="flex items-center gap-2 font-semibold"><Layers size={16} /> Biblioteca de ambientes</h3>
            <p className={`mb-2 text-sm ${muted}`}>Ambientes reutilizáveis em qualquer modelo.</p>
            <ul className="flex flex-wrap gap-2">
              {LIB.map((l) => <li key={l} className="rounded-full border border-[var(--admin-border)] px-3 py-1.5 text-sm">{l}</li>)}
            </ul>
          </section>

          <section className={`${card} p-4`}>
            <h3 className="flex items-center gap-2 font-semibold"><Home size={16} /> Ambientes por imóvel</h3>
            <p className={`mb-2 text-sm ${muted}`}>Exemplo: “Imóvel A” usa o modelo Pré-check-in e ajusta apenas os ambientes opcionais. Sem vínculo real com imóveis.</p>
            <ul className="divide-y divide-[var(--admin-border)]">
              {[["Sala", "Ativa", "success"], ["Varanda", "Ativa", "success"], ["Lavabo", "Não se aplica", "neutral"], ["Quarto adicional", "Ativo", "success"]].map(([n, s, t]) => (
                <li key={n} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>{n}</span><AdminStatusBadge tone={t as AdminTone}>{s}</AdminStatusBadge>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* 3. Prévia */}
        <aside className={`${mobileTab === "previa" ? "" : "hidden"} lg:block`}>
          <div className="lg:sticky lg:top-4">
            <p className={`mb-2 flex items-center gap-1 text-sm ${muted}`}><Eye size={14} /> Prévia de campo — somente visual</p>
            <Phone roomName={room.name} item={item} step={itemIdx + 1} total={room.items.length} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Phone({ roomName, item, step, total }: { roomName: string; item: Item; step: number; total: number }) {
  const a = ANSWER[item.answer];
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border-8 border-[var(--admin-text)] bg-[var(--admin-surface)] p-4">
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-[var(--admin-border)]" />
      <p className={`flex items-center gap-1 text-xs ${muted}`}><ListChecks size={12} /> Ambiente</p>
      <p className="text-lg font-semibold">{roomName}</p>
      <div className="mt-2 h-1.5 rounded-full bg-[var(--admin-border)]">
        <div className="h-1.5 rounded-full bg-[var(--admin-primary)]" style={{ width: `${(step / total) * 100}%` }} />
      </div>
      <p className={`mt-1 text-xs ${muted}`}>Item {step} de {total}</p>
      <p className="mt-4 font-medium">{item.title}{item.required ? "" : " (opcional)"}</p>
      <p className={`text-sm ${muted}`}>{item.hint}</p>
      <div className="mt-3">
        {a.kind === "Foto" && (
          <div className="flex h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--admin-border)] text-sm">
            <Camera size={22} /> Tirar foto
          </div>
        )}
        {item.answer === "sim_nao" && (
          <div className="grid grid-cols-2 gap-2">{["Sim", "Não"].map((o) => <span key={o} className="rounded-lg border border-[var(--admin-border)] py-2 text-center text-sm">{o}</span>)}</div>
        )}
        {item.answer === "texto" && <div className={`rounded-lg border border-[var(--admin-border)] p-2 text-sm ${muted}`}>Escreva em poucas palavras…</div>}
        {a.kind === "Condição" && (
          <>
            <div className="grid grid-cols-3 gap-1">{["OK", "Atenção", "Problema"].map((o) => <span key={o} className="rounded-lg border border-[var(--admin-border)] py-2 text-center text-xs">{o}</span>)}</div>
            {item.answer === "condicao_foto" && <p className={`mt-2 flex items-center gap-1 text-xs ${muted}`}><Camera size={12} /> Foto obrigatória em Atenção ou Problema</p>}
          </>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between gap-2 text-sm">
        <span className="underline">Pular por enquanto</span>
        <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--admin-primary)] px-3 py-2 text-[var(--admin-primary-foreground,white)]">Próximo <ChevronRight size={14} /></span>
      </div>
    </div>
  );
}
