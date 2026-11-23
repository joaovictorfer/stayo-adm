import { ClipboardList, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { splitAmount, type CostTask, type PersonCost } from "@/lib/op-costs";
import { formatBRL } from "@/lib/money";

export function OperationalServicesSheet({ person, tasks, onClose }: { person: PersonCost | null; tasks: CostTask[]; onClose: () => void }) {
  const services = person ? tasks.filter((task) => task.status === "concluida" && task.amount !== null && (person.key === "none" ? task.team.length === 0 : task.team.some((member) => member.staffId === person.key))) : [];
  return <Sheet open={person !== null} onOpenChange={(open) => { if (!open) onClose(); }}><SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[650px] [&>button]:text-primary-foreground">{person && <>
    <SheetHeader className="shrink-0 border-b border-border bg-primary px-5 py-6 pr-12 text-left"><p className="text-xs font-semibold uppercase text-primary-foreground">Operação · Serviços</p><SheetTitle className="text-primary-foreground">{person.name}</SheetTitle><SheetDescription className="text-primary-foreground">{services.length} serviços concluídos no mês</SheetDescription></SheetHeader>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><ClipboardList className="size-4 text-primary" />Serviços por imóvel</h3>
      <div className="space-y-3">{services.map((task) => {
        const index = task.team.findIndex((member) => member.staffId === person.key);
        const amount = task.amount === null ? null : task.team.length === 0 ? task.amount : splitAmount(task.amount, task.team.map((member) => member.share))[index] ?? null;
        return <div key={task.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-border border-l-2 border-l-primary p-4"><div className="min-w-0"><p className="text-xs text-muted-foreground">{new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("pt-BR")}</p><p className="mt-1 break-words text-sm font-semibold">{task.propertyName ?? "Sem imóvel"}</p><p className="mt-1 break-words text-sm text-muted-foreground">{task.title}</p></div><strong className="text-sm tabular-nums">{amount === null ? "Não informado" : formatBRL(amount)}</strong></div>;
      })}{services.length === 0 && <p className="text-sm text-muted-foreground">Nenhum serviço com valor neste mês.</p>}</div>
      <section className="space-y-3 border-t border-border pt-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><Wallet className="size-4 text-primary" />Reembolsos</h3><dl className="space-y-2 text-sm">{[["Aguardando aprovação", person.reimbPending], ["Aprovados", person.reimbApproved], ["Já pagos", person.reimbPaid]].map(([label, amount]) => <div key={String(label)} className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{formatBRL(Number(amount))}</dd></div>)}</dl></section>
    </div>
    <div className="shrink-0 space-y-3 border-t border-border bg-muted/30 p-5"><dl className="flex items-center justify-between gap-3"><dt className="text-sm text-muted-foreground">Serviços + reembolsos aprovados</dt><dd className="text-xl font-semibold tabular-nums">{formatBRL(person.toPay)}</dd></dl><Button variant="outline" className="w-full" onClick={onClose}>Fechar conferência</Button></div>
  </>}</SheetContent></Sheet>;
}