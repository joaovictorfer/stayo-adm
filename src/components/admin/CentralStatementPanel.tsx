import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readCentralStatement } from "@/lib/stayo-central/reads.functions";
import { presentStatement, originLabels, reliabilityLabels, type CentralStatement } from "@/lib/stayo-central/statement";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CentralStatementView({ statement }: { statement: CentralStatement }) {
  const report = presentStatement(statement);
  return <section className="space-y-4 border-y border-border py-5">
    <header className="flex items-center gap-2"><FileText className="size-5 text-primary"/><h2 className="text-lg font-semibold">Demonstrativo da reserva</h2></header>
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-muted-foreground">Reserva</dt><dd>{report.reservation.reservation_code ?? report.reservation.id}</dd></div>
      <div><dt className="text-muted-foreground">Imóvel</dt><dd>{report.property?.name ?? "Indisponível"}</dd></div>
      <div><dt className="text-muted-foreground">Período</dt><dd>{report.reservation.checkin_date ?? "—"} · {report.reservation.checkout_date ?? "—"}</dd></div>
      <div><dt className="text-muted-foreground">Hóspede titular</dt><dd>{report.titular ?? (report.titularStatus === "ambiguous" ? "Titularidade ambígua" : "Não informado")}</dd></div>
    </dl>
    <div className="divide-y divide-border">{report.rows.map(row => <div className="flex flex-wrap items-start justify-between gap-2 py-3" key={row.key}>
      <div><p className="text-sm font-medium">{row.label}</p><p className="text-xs text-muted-foreground">{originLabels[row.origin]} · {reliabilityLabels[row.reliability]}</p><p className="text-xs text-muted-foreground break-all">{row.source ?? "Fonte não informada"}</p></div>
      <span className="text-sm font-semibold tabular-nums">{row.cents === null ? "Indisponível" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(row.cents / 100)}</span>
    </div>)}</div>
    <Alert><ShieldCheck className="size-4"/><AlertDescription><ul className="space-y-1">{report.warnings.map(w => <li key={w}>{w}</li>)}</ul></AlertDescription></Alert>
    <p className="text-xs text-muted-foreground">Atualização na origem: {report.updatedAt ? new Date(report.updatedAt).toLocaleString("pt-BR") : "Não informada"}</p>
  </section>;
}

export function CentralStatementPanel({ reservationId }: { reservationId: string }) {
  const read = useServerFn(readCentralStatement);
  // No shared cache, background polling, stale-data display or automatic retries.
  const q = useQuery({ queryKey: ["central-statement", reservationId], queryFn: () => read({ data: { reservationId } }), retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false });
  if (q.isPending) return <div role="status" aria-label="Carregando demonstrativo" className="my-5 h-24 animate-pulse bg-muted"/>;
  if (q.isError) return <section className="my-5 space-y-3"><h2 className="font-semibold">Demonstrativo da reserva</h2><p className="text-sm text-muted-foreground">Consulta restrita ou temporariamente indisponível.</p><Button variant="outline" onClick={() => q.refetch()}><RefreshCw/>Tentar novamente</Button></section>;
  if (!q.data?.ok) return <section className="my-5 border-y border-border py-4"><h2 className="font-semibold">Demonstrativo da reserva</h2><p role="status" className="mt-2 text-sm text-muted-foreground">{q.data?.message ?? "Integração ainda não configurada"}</p></section>;
  return <CentralStatementView statement={q.data.statement}/>;
}