import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ChevronDown, Clock3, MapPin, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { OpChecklistList } from "@/components/admin/OpChecklistList";
import { StayoLogo } from "@/components/brand/StayoLogo";
import { Button } from "@/components/ui/button";
import { checkMyItem, getMyDay, setMyTaskStatus, uploadMyPhoto } from "@/lib/my-day.functions";
import { blockerMessage } from "@/lib/op-execution-rules";

export const Route = createFileRoute("/meu-dia/$token")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Meu Dia · STAYO Gramado" },
    { name: "description", content: "Suas tarefas do dia: iniciar, checklist com fotos e conclusão." },
    { property: "og:title", content: "Meu Dia · STAYO Gramado" },
    { property: "og:description", content: "Tarefas operacionais do dia da equipe STAYO." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: MeuDiaPage,
});

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const kinds: Record<string, string> = { limpeza: "Limpeza", vistoria: "Vistoria", manutencao: "Manutenção", checkin: "Check-in", checkout: "Check-out", outro: "Outro" };

function MeuDiaPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const [range, setRange] = useState<"hoje" | "semana">("hoje");
  const [open, setOpen] = useState<string | null>(null);
  const today = new Date(); const end = new Date(); end.setDate(end.getDate() + (range === "hoje" ? 0 : 6));
  const from = new Date(); from.setDate(from.getDate() - 3); // inclui atrasadas recentes
  const key = ["meu-dia", token, range];
  const q = useQuery({ queryKey: key, queryFn: () => getMyDay({ data: { token, from: iso(range === "hoje" ? from : today), to: iso(end) } }), retry: false });
  const refresh = () => qc.invalidateQueries({ queryKey: ["meu-dia", token] });
  const status = useMutation({ mutationFn: (v: { taskId: string; status: "em_andamento" | "concluida" }) => setMyTaskStatus({ data: { token, ...v } }), onSuccess: (_, v) => { toast.success(v.status === "concluida" ? "Tarefa concluída" : "Tarefa iniciada"); void refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const tasks = (q.data?.tasks ?? []).filter((t) => range === "semana" || t.dueDate === iso(today) || t.status !== "concluida");
  const doneCount = tasks.filter((t) => t.status === "concluida").length;

  return <div className="min-h-dvh bg-background text-foreground">
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3"><StayoLogo className="h-8 w-auto" />
        <span className="text-right text-xs text-muted-foreground">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(today)}</span></div>
    </header>
    <main className="mx-auto grid max-w-xl gap-4 px-4 py-5">
      {q.isPending ? <p className="text-sm text-muted-foreground">Carregando suas tarefas…</p>
        : q.isError ? <div className="rounded-xl border border-border p-6 text-center"><h1 className="font-[var(--stayo-font-display)] text-xl">Link indisponível</h1><p className="mt-2 text-sm text-muted-foreground">Este link expirou ou foi substituído. Peça um novo à equipe STAYO.</p></div>
        : <>
          <div><h1 className="font-[var(--stayo-font-display)] text-2xl">Olá, {q.data.name.split(" ")[0]}</h1>
            <p className="text-sm text-muted-foreground">{tasks.length ? `${doneCount} de ${tasks.length} ${tasks.length === 1 ? "tarefa concluída" : "tarefas concluídas"}` : "Nenhuma tarefa para este período."}</p></div>
          <div role="tablist" className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
            {(["hoje", "semana"] as const).map((r) => <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)} className={`rounded-md py-2 font-medium ${range === r ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{r === "hoje" ? "Hoje" : "Próximos 7 dias"}</button>)}
          </div>
          {tasks.map((t) => {
            const expanded = open === t.id; const blockers = blockerMessage(t.items); const finished = t.status === "concluida";
            const late = !finished && t.dueDate < iso(today);
            return <article key={t.id} className={`overflow-hidden rounded-xl border bg-card ${finished ? "border-border opacity-80" : late ? "border-destructive/50" : "border-border"}`}>
              <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : t.id)} className="flex w-full items-start gap-3 p-4 text-left">
                <span className="grid min-w-[3.25rem] text-center"><strong className="text-base">{t.time ?? "—"}</strong><small className="text-[11px] text-muted-foreground">{new Date(`${t.dueDate}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</small></span>
                <span className="min-w-0 flex-1"><b className="block text-sm">{t.title}</b>
                  <small className="block text-xs text-muted-foreground">{kinds[t.kind] ?? t.kind}{t.property ? ` · ${t.property}` : ""}</small>
                  <small className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${finished ? "bg-primary/10 text-primary" : t.status === "em_andamento" ? "bg-accent text-accent-foreground" : late ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{finished ? "Concluída" : t.status === "em_andamento" ? "Em andamento" : late ? "Atrasada" : "A fazer"}</small></span>
                <ChevronDown className={`mt-1 size-5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded && <div className="grid gap-3 border-t border-border p-4">
                {t.address && <p className="flex items-start gap-2 text-xs text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0" />{t.address}</p>}
                {t.guidance && <p className="rounded-lg bg-muted p-3 text-sm">{t.guidance}</p>}
                {t.status === "pendente" && <Button size="lg" onClick={() => status.mutate({ taskId: t.id, status: "em_andamento" })} disabled={status.isPending}><Play className="size-4" />Iniciar tarefa</Button>}
                {t.status !== "pendente" && <OpChecklistList items={t.items} disabled={finished}
                  onToggle={async (id, checked) => { try { await checkMyItem({ data: { token, itemId: id, checked } }); await refresh(); } catch (e) { toast.error((e as Error).message); } }}
                  onPhoto={async (id, base64) => { try { await uploadMyPhoto({ data: { token, itemId: id, base64 } }); await refresh(); toast.success("Foto enviada"); } catch (e) { toast.error((e as Error).message); } }} />}
                {t.status === "em_andamento" && <>
                  {blockers && <p className="text-xs text-destructive">{blockers}</p>}
                  <Button size="lg" onClick={() => status.mutate({ taskId: t.id, status: "concluida" })} disabled={status.isPending || !!blockers}><CheckCircle2 className="size-4" />Concluir tarefa</Button></>}
                {finished && t.completedAt && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" />Concluída às {new Date(t.completedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
              </div>}
            </article>;
          })}
        </>}
    </main>
  </div>;
}
