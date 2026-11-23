import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminPageHeader, AdminStatusBadge } from "./AdminPrimitives";
import { CompactSearch, ModuleTabs } from "./PhaseOnePatterns";
import { ReservationPreparation } from "./ReservationPreparation";
import { SyncUpcomingButton } from "./SyncUpcomingButton";
import { operationalCalendarQuery } from "@/lib/api/op-calendar-api";
import { cleaningBoardQuery } from "@/lib/api/op-cleaning-api";
import { localISODate } from "@/lib/local-date";
import { BrazilianDateInput } from "@/components/ui/brazilian-date-input";
import { Button } from "@/components/ui/button";
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export function CheckinPreparationPanel() {
  const today = localISODate();
  const [date, setDate] = useState(today);
  const [tab, setTab] = useState<"chegadas" | "saidas" | "em_casa">("chegadas");
  const [search, setSearch] = useState("");
  const data = useQuery(operationalCalendarQuery());
  const board = useQuery(cleaningBoardQuery(today));
  const properties = new Map((board.data?.rows ?? []).map((p) => [p.id, p]));
  const stays = (data.data?.stays ?? []).filter((s) => properties.has(s.implementationId));
  const inTab = (s: typeof stays[number], t: typeof tab) => t === "chegadas" ? s.checkin === date : t === "saidas" ? s.checkout === date : s.checkin < date && s.checkout > date;
  const shown = stays.filter((s) => inTab(s, tab) && `${properties.get(s.implementationId)?.property} ${s.guest}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  return <div className="space-y-5">
    <AdminPageHeader eyebrow="Operação" title="Preparação de check-in" actions={<SyncUpcomingButton />} />
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm font-medium">Dia<BrazilianDateInput aria-label="Dia da preparação" className="admin-input h-10 px-3" value={date} onValueChange={(value) => { if (value) setDate(value); }} /></label><div className="w-full sm:w-72"><CompactSearch value={search} onChange={setSearch} placeholder="Buscar imóvel ou hóspede" /></div></div>
    <ModuleTabs value={tab} onChange={setTab} options={[{ value: "chegadas", label: `Chegadas ${stays.filter((s) => inTab(s, "chegadas")).length}` }, { value: "saidas", label: `Saídas ${stays.filter((s) => inTab(s, "saidas")).length}` }, { value: "em_casa", label: `Em casa ${stays.filter((s) => inTab(s, "em_casa")).length}` }]} />
    {data.isPending || board.isPending ? <p className="text-sm text-muted-foreground">Carregando reservas…</p> : data.isError || board.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar as reservas.<Button variant="link" onClick={() => { void data.refetch(); void board.refetch(); }}>Tentar novamente</Button></p> : !shown.length ? <p className="py-10 text-sm text-muted-foreground">Nenhuma reserva neste filtro.</p> : <div className="space-y-3">{shown.map((s) => {
      const property = properties.get(s.implementationId);
      return <article key={s.id} data-reservation-id={s.id} className="grid gap-5 rounded-md border border-border bg-background p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:p-5">
        <div className="space-y-3"><h2 className="break-words font-[var(--stayo-font-display)] text-lg font-semibold">{property?.property}</h2><p className="text-sm font-medium">{s.guest}</p><div className="flex flex-wrap gap-3 text-xs text-muted-foreground"><span>Check-in <strong className="text-foreground">{dm(s.checkin)}</strong></span><span>Check-out <strong className="text-foreground">{dm(s.checkout)}</strong></span></div><AdminStatusBadge tone="neutral">Limpeza hoje: {property?.status.state === "pronto" ? "Pronto" : property?.status.state === "ocupado" ? "Ocupado" : property?.status.state === "sujo" ? "Sujo" : "Sem registro"}</AdminStatusBadge></div>
        <ReservationPreparation reservationId={s.id} />
      </article>;
    })}</div>}
  </div>;
}