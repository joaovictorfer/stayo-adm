import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarCheck, Camera, CheckCircle2, ChevronDown, ClipboardCheck, Clock, Lock, RotateCcw, ShieldAlert, User, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { AdminEmptyState, AdminPageHeader, AdminSection, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthSession } from "@/lib/auth/session";
import { burnEvidence, loadImage } from "@/lib/vistoria/evidence";
import salaImg from "@/assets/vistoria-demo-sala.jpg";
import cozinhaImg from "@/assets/guide-cookware.jpg";
import banheiroImg from "@/assets/guide-cutlery.jpg";

/**
 * Revisão interna da vistoria (Admin). Protótipo isolado: não compartilha
 * código de tela com o link externo. Sem backend de vistorias ainda —
 * decisões ficam só nesta tela e o acesso real precisará de RLS no servidor.
 */

const search = z.object({
  estado: z.enum(["normal", "carregando", "vazio", "erro", "sem_permissao", "outro_imovel"]).optional(),
});

export const Route = createFileRoute("/operacao/vistorias-revisao")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Revisão de vistoria (protótipo) — Stayo Admin" },
      { name: "description", content: "Revisão interna de vistoria: evidências com marca-d'água, ocorrências e decisão." },
      { property: "og:title", content: "Revisão de vistoria (protótipo) — Stayo Admin" },
      { property: "og:description", content: "Aprovar ou devolver uma vistoria com auditoria, sem liberar o imóvel automaticamente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewPage,
});

type Cond = "ok" | "atencao" | "problema" | "nao_aplica" | "pendente";
interface Item { id: string; room: string; name: string; cond: Cond; note?: string; photo?: string; critical?: boolean }
interface Instance {
  id: string; propertyId: string; property: string; kind: string; reservation?: string; reservationAuthorized: boolean;
  responsible: string; startedAt: string; submittedAt: string; status: "enviada" | "devolvida" | "aprovada"; items: Item[];
}

const REVIEW_ROLES = ["super_admin", "admin", "operations"];
// Escopo de imóveis do revisor (no servidor isso virá da RLS por imóvel).
const DEMO_SCOPE = ["prop-204"];

const DEMO: Instance = {
  id: "VST-2026-0142", propertyId: "prop-204", property: "Apto 204 · Centro", kind: "Pré-check-in",
  reservation: "Reserva #48213 · Mariana S. · 02–05 out", reservationAuthorized: true,
  responsible: "Equipe STAYO", startedAt: "2025-05-12T13:44:00", submittedAt: "2025-05-12T14:26:00", status: "enviada",
  items: [
    { id: "i1", room: "Sala", name: "Tomada com folga", cond: "problema", note: "Tomada com folga na fixação. Necessário ajuste.", photo: salaImg, critical: true },
    { id: "i2", room: "Sala", name: "Sofá", cond: "ok", photo: salaImg },
    { id: "i3", room: "Cozinha", name: "Panelas", cond: "atencao", note: "Uma tampa faltando", photo: cozinhaImg },
    { id: "i4", room: "Cozinha", name: "Geladeira fechada", cond: "ok", photo: cozinhaImg },
    { id: "i5", room: "Suíte", name: "Box com trinca", cond: "problema", note: "Trinca no vidro do box. Avaliar substituição.", photo: banheiroImg, critical: true },
    { id: "i6", room: "Suíte", name: "Toalhas", cond: "pendente" },
    ...Array.from({ length: 22 }, (_, k) => ({ id: `x${k}`, room: ["Entrada", "Sala", "Cozinha", "Dormitório", "Banheiro"][k % 5]!, name: `Item ${k + 7}`, cond: "ok" as Cond })),
  ],
};

const fmt = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

interface Audit { at: string; who: string; action: string; detail?: string | undefined }

function useBurned(inst: Instance | null) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!inst) return;
    let alive = true; const made: string[] = [];
    (async () => {
      for (const it of inst.items.filter((i) => i.photo)) {
        try {
          const img = await loadImage(it.photo!);
          const { blob } = await burnEvidence(img, {
            inspectionId: inst.id, inspectionKind: inst.kind, inspectionStatus: "Enviada", property: inst.property,
            room: it.room, itemId: it.id, itemName: it.name, author: inst.responsible, guest: { firstName: "Mariana", lastName: "Souza" },
          }, new Date(inst.submittedAt));
          const u = URL.createObjectURL(blob); made.push(u);
          if (alive) setUrls((p) => ({ ...p, [it.id]: u }));
        } catch { /* foto sem marca não é exibida */ }
      }
    })();
    return () => { alive = false; made.forEach(URL.revokeObjectURL); };
  }, [inst]);
  return urls;
}

function ReviewPage() {
  const { estado = "normal" } = Route.useSearch();
  const auth = useAuthSession();
  const role = auth.profile?.role ?? (auth.status === "not_required" ? "admin" : undefined);
  const [phase, setPhase] = useState<"loading" | "ready">("loading");
  useEffect(() => { const t = setTimeout(() => setPhase("ready"), 400); return () => clearTimeout(t); }, [estado]);

  const inst = estado === "vazio" || estado === "erro" ? null : estado === "outro_imovel" ? { ...DEMO, propertyId: "prop-999" } : DEMO;
  const roleOk = estado !== "sem_permissao" && !!role && REVIEW_ROLES.includes(role);
  const scopeOk = !!inst && DEMO_SCOPE.includes(inst.propertyId);
  const allowed = roleOk && scopeOk;

  const header = (
    <AdminPageHeader eyebrow="Operação · Vistorias" title="Revisão da vistoria"
      meta={<AdminStatusBadge tone="info">Protótipo · sem gravação</AdminStatusBadge>}
      actions={<Link to="/operacao/vistorias-prototipo" className="text-sm underline">Voltar às vistorias</Link>} />
  );

  if (estado === "carregando" || phase === "loading" || auth.status === "loading")
    return <div className="space-y-4">{header}<div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}</div></div>;
  if (estado === "erro")
    return <div className="space-y-4">{header}<AdminEmptyState icon={AlertTriangle} title="Não foi possível abrir a vistoria" description="Verifique a conexão e tente de novo." action={<Button onClick={() => setPhase("loading")}>Tentar de novo</Button>} /></div>;
  if (!inst)
    return <div className="space-y-4">{header}<AdminEmptyState title="Nenhuma vistoria enviada para revisão" description="Quando um vistoriador enviar, ela aparece aqui." /></div>;
  if (!allowed)
    return <div className="space-y-4">{header}<AdminEmptyState icon={Lock} title="Você não tem acesso a esta vistoria"
      description={!roleOk ? "Revisão disponível para Admin e Operações." : "Esta vistoria é de um imóvel fora do seu escopo. Fotos e ocorrências não são carregadas."} /></div>;

  return <div className="space-y-4">{header}<ReviewBody inst={inst} who={auth.profile?.fullName ?? "Equipe STAYO"} /></div>;
}

function ReviewBody({ inst, who }: { inst: Instance; who: string }) {
  const urls = useBurned(inst);
  const [status, setStatus] = useState(inst.status);
  const [audit, setAudit] = useState<Audit[]>([{ at: inst.submittedAt, who: inst.responsible, action: "Vistoria enviada" }]);
  const [dialog, setDialog] = useState<null | "devolver" | "aprovar">(null);
  const [text, setText] = useState("");
  const [zoom, setZoom] = useState<Item | null>(null);
  const [assignee, setAssignee] = useState<Record<string, string>>({});

  const counts = useMemo(() => {
    const c: Record<Cond, number> = { ok: 0, atencao: 0, problema: 0, nao_aplica: 0, pendente: 0 };
    inst.items.forEach((i) => c[i.cond]++); return c;
  }, [inst]);
  const occurrences = inst.items.filter((i) => i.cond === "problema" || i.cond === "atencao" || i.cond === "pendente");
  const blockers = inst.items.filter((i) => i.critical || i.cond === "pendente");
  const photos = inst.items.filter((i) => urls[i.id]);
  const done = inst.items.length - counts.pendente;
  const locked = status !== "enviada";
  const durationMin = Math.max(1, Math.round((new Date(inst.submittedAt).getTime() - new Date(inst.startedAt).getTime()) / 60000));

  const log = (action: string, detail?: string) => setAudit((a) => [{ at: new Date().toISOString(), who, action, detail }, ...a]);
  const confirm = () => {
    if (dialog === "devolver") { setStatus("devolvida"); log("Devolvida para correção (somente esta vistoria)", text); }
    else { setStatus("aprovada"); log(blockers.length ? "Aprovada com override de bloqueios" : "Aprovada", text || undefined); }
    setDialog(null); setText("");
  };
  const needText = dialog === "devolver" || (dialog === "aprovar" && blockers.length > 0);

  return (
    <div className="space-y-4">
      {/* Cabeçalho da instância: imóvel, tipo, reserva, status */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vistoria {inst.kind.toLowerCase()}</h2>
          <p className="text-muted-foreground">{inst.property}{inst.reservationAuthorized && inst.reservation ? ` · ${inst.reservation}` : ""}</p>
          {!inst.reservationAuthorized && <p className="text-xs text-muted-foreground">Reserva não exibida: sem autorização.</p>}
        </div>
        <AdminStatusBadge tone={status === "aprovada" ? "success" : status === "devolvida" ? "warning" : "info"}>
          <Clock className="h-3.5 w-3.5" /> {status === "aprovada" ? "Aprovada" : status === "devolvida" ? "Devolvida para correção" : "Aguardando revisão"}
        </AdminStatusBadge>
      </div>

      {/* Resumo em cartões */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<ClipboardCheck className="h-5 w-5" />} tone="primary" label="Itens verificados" value={`${done}/${inst.items.length}`} hint="itens" />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} tone="danger" label="Ocorrências" value={String(occurrences.length)} hint={occurrences.length === 1 ? "ocorrência" : "ocorrências"} />
        <StatCard icon={<User className="h-5 w-5" />} tone="muted" label="Responsável pela vistoria" value={inst.responsible} hint="Vistoria por link externo" />
        <StatCard icon={<CalendarCheck className="h-5 w-5" />} tone="muted" label="Concluída em" value={fmt(inst.submittedAt)} hint={`Duração: ${durationMin} min`} />
      </div>
      <p className="text-xs text-muted-foreground">
        Resumo por condição: {counts.ok} OK · {counts.atencao} Atenção · {counts.problema} Problema · {counts.nao_aplica} Não se aplica · {counts.pendente} Pendente · {inst.id}
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Galeria de evidências */}
        <AdminSection title="Evidências da vistoria" description={`${photos.length} fotos · identificação gravada na imagem`}>
          {photos.length === 0 ? <p className="text-sm text-muted-foreground">Preparando fotos…</p> : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{photos.map((i) => (
              <button key={i.id} onClick={() => setZoom(i)} className="overflow-hidden rounded-md border text-left">
                <img src={urls[i.id]} alt={`${i.room} · ${i.name}`} className="aspect-[4/3] w-full object-cover" />
                <p className="truncate px-2 py-1 text-xs">{i.room} · {i.name}</p></button>))}</div>)}
        </AdminSection>

        {/* Ocorrências + decisão */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <AdminSection title="Ocorrências para revisão" description={`${occurrences.length} ${occurrences.length === 1 ? "ocorrência" : "ocorrências"} · nenhuma gera manutenção ou cobrança automaticamente`}>
            {occurrences.length === 0 ? <p className="text-sm text-muted-foreground">Sem ocorrências.</p> : (
              <ol className="space-y-4">{occurrences.map((i, n) => (
                <li key={i.id} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-destructive/15 text-xs font-semibold text-destructive">{n + 1}</span>
                    <p className="min-w-0 flex-1 font-medium">{i.name} · {i.room}</p>
                    <AdminStatusBadge tone={i.cond === "problema" ? "danger" : "warning"}>{i.cond === "problema" ? "Correção necessária" : i.cond === "pendente" ? "Pendente" : "Acompanhar"}</AdminStatusBadge>
                  </div>
                  {urls[i.id]
                    ? <button onClick={() => setZoom(i)} aria-label={`Ampliar foto de ${i.name}`}><img src={urls[i.id]} alt="" className="aspect-[4/3] w-full rounded-md object-cover" /></button>
                    : <div className="grid aspect-[4/3] w-full place-items-center rounded-md bg-muted text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><Camera className="h-4 w-4" /> {i.cond === "problema" ? "Sem foto enviada" : "Sem foto"}</span></div>}
                  {i.note && <div><p className="text-xs text-muted-foreground">Descrição</p><p className="text-sm">{i.note}</p></div>}
                  {i.critical && <p className="flex items-center gap-1.5 text-xs font-medium text-destructive"><ShieldAlert className="h-3.5 w-3.5" /> Bloqueio crítico — imóvel não liberado</p>}
                  <div>
                    <p className="text-xs text-muted-foreground">Responsável</p>
                    <div className="relative">
                      <select
                        value={assignee[i.id] ?? "Equipe Manutenção"}
                        onChange={(e) => { setAssignee((a) => ({ ...a, [i.id]: e.target.value })); log("Responsável atribuído", `${i.room} · ${i.name} → ${e.target.value}`); }}
                        aria-label={`Responsável por ${i.name}`}
                        className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-8 text-sm"
                      >
                        <option>Equipe Manutenção</option>
                        <option>Equipe Limpeza</option>
                        <option>Equipe STAYO</option>
                        <option>Fornecedor externo</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </li>))}</ol>)}
          </AdminSection>

          <AdminSection title="Prontidão do imóvel">
            {blockers.length ? (<div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 font-medium text-destructive"><ShieldAlert className="h-4 w-4" />Imóvel não liberado · {blockers.length} bloqueio(s)</p>
              <ul className="list-disc pl-5 text-muted-foreground">{blockers.map((b) => <li key={b.id}>{b.room} · {b.name}{b.cond === "pendente" ? " (pendente)" : ""}</li>)}</ul>
              <p className="text-xs text-muted-foreground">Aprovar a vistoria não libera o imóvel. Os bloqueios seguem até serem resolvidos.</p></div>)
              : <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" />Sem bloqueios críticos.</p>}
          </AdminSection>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={locked} onClick={() => setDialog("devolver")}><RotateCcw className="mr-2 h-4 w-4" />Devolver para correção</Button>
            <Button disabled={locked} onClick={() => setDialog("aprovar")}><CheckCircle2 className="mr-2 h-4 w-4" />Aprovar vistoria</Button>
          </div>
          {locked && <p className="text-xs text-muted-foreground">Decisão registrada. Só esta vistoria foi afetada.</p>}

          <AdminSection title="Histórico">
            <ol className="space-y-2 text-sm">{audit.map((a, k) => (
              <li key={k}><p className="font-medium">{a.action}</p><p className="text-xs text-muted-foreground">{a.who} · {fmt(a.at)}</p>{a.detail && <p className="text-xs">“{a.detail}”</p>}</li>))}</ol>
          </AdminSection>
        </aside>
      </div>

      {dialog && (
        <div role="dialog" aria-modal="true" aria-labelledby="dlg-t" className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-lg bg-background p-5 shadow-lg">
            <h2 id="dlg-t" className="text-lg font-semibold">{dialog === "devolver" ? "Devolver para correção" : blockers.length ? "Aprovar com bloqueios" : "Aprovar vistoria"}</h2>
            <p className="text-sm text-muted-foreground">{dialog === "devolver" ? "Reabre somente esta vistoria para o vistoriador. O motivo fica no histórico."
              : blockers.length ? `Existem ${blockers.length} bloqueio(s). A aprovação exige justificativa (override auditado) e o imóvel continua não liberado.` : "O imóvel não é marcado como pronto por esta aprovação."}</p>
            {(needText || dialog === "aprovar") && <Textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 300))}
              placeholder={dialog === "devolver" ? "Motivo (obrigatório)" : blockers.length ? "Justificativa do override (obrigatória)" : "Observação interna (opcional)"} aria-label="Motivo" />}
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => { setDialog(null); setText(""); }}>Cancelar</Button>
              <Button disabled={needText && text.trim().length < 5} onClick={confirm}>Confirmar</Button></div>
          </div>
        </div>)}

      {zoom && urls[zoom.id] && (
        <div role="dialog" aria-modal="true" aria-label={`${zoom.room} · ${zoom.name}`} className="fixed inset-0 z-50 grid place-items-center bg-foreground/80 p-4" onClick={() => setZoom(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-background p-2" aria-label="Fechar"><X className="h-4 w-4" /></button>
          <img src={urls[zoom.id]} alt={`${zoom.room} · ${zoom.name}`} className="max-h-[85vh] max-w-full rounded" />
        </div>)}
    </div>
  );
}

function StatCard({ icon, tone, label, value, hint }: { icon: React.ReactNode; tone: "primary" | "danger" | "muted"; label: string; value: string; hint: string }) {
  const toneCls = tone === "primary" ? "bg-primary/10 text-primary" : tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
      <span className={`grid size-11 shrink-0 place-items-center rounded-full ${toneCls}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-semibold leading-tight">{value} <span className="text-xs font-normal text-muted-foreground">{hint}</span></p>
      </div>
    </div>
  );
}
