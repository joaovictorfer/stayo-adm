import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Link2, Settings2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../ui/dialog";
import { OwnerInviteSection } from "../OwnerInviteSection";
import { OwnerPortalPanel } from "../OwnerPortalPanel";
import { OwnerJourneyStatus } from "./OwnerJourneyStatus";
import { SectionBoundary } from "./SectionBoundary";
import { ownerQuery } from "../../../lib/api/queries";
import { OwnerWorkspaceLinkPanel } from './OwnerWorkspaceLinkPanel';
import type { ImplementationProject } from "../../../types/core";
import type { CommercialProposalVersion } from "../../../types/commercial-proposal";

export function OwnerLinksHub({ implementation, versions }: { implementation: ImplementationProject; versions: CommercialProposalVersion[] }) {
  const [open, setOpen] = useState<"access" | "presentation" | "workspace" | null>(null);
  const owner = useQuery({ ...ownerQuery(implementation.ownerId ?? ""), enabled: Boolean(implementation.ownerId) });
  const ownerName = owner.data?.name ?? implementation.ownerName;
  return <div className="min-w-0 space-y-3">
    <OwnerJourneyStatus implementationId={implementation.id} versions={versions} />
    <section aria-label="Links do proprietário" className="min-w-0 rounded-lg border border-[var(--stayo-border)] bg-[var(--stayo-surface)] p-4">
      <h3 className="flex items-center gap-2 font-[Outfit] text-base font-semibold text-[var(--stayo-navy)]"><Link2 className="size-4" />Links do proprietário</h3>
      <div className="mt-2 divide-y divide-[var(--stayo-border)]">
        <Button variant="ghost" className="h-auto w-full justify-between gap-3 whitespace-normal rounded-none px-0 py-3 text-left" onClick={() => setOpen('workspace')}><span><span className="block text-sm font-semibold">Portal do imóvel e repasses</span><span className="block text-xs font-normal text-muted-foreground">Reservas, balancete e histórico · link dedicado</span></span><Link2 className="size-4 shrink-0"/></Button>
        <Button variant="ghost" className="h-auto w-full justify-between gap-3 whitespace-normal rounded-none px-0 py-3 text-left" onClick={() => setOpen("access")}><span className="min-w-0"><span className="block text-sm font-semibold">Cadastro e acesso</span><span className="block text-xs font-normal text-[var(--stayo-ink-muted)]">Confirmar proposta e preencher cadastro</span></span><Settings2 className="size-4 shrink-0" /></Button>
        <Button variant="ghost" className="h-auto w-full justify-between gap-3 whitespace-normal rounded-none px-0 py-3 text-left" onClick={() => setOpen("presentation")}><span className="min-w-0"><span className="block text-sm font-semibold">Apresentação da proposta</span><span className="block text-xs font-normal text-[var(--stayo-ink-muted)]">Somente leitura</span></span><Eye className="size-4 shrink-0" /></Button>
      </div>
    </section>
    <Dialog open={open !== null} onOpenChange={value => { if (!value) setOpen(null); }}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1rem)] min-w-0 flex-col overflow-hidden rounded-lg sm:max-w-2xl">
        <DialogHeader><DialogTitle>{open === 'workspace' ? 'Portal do imóvel e repasses' : open === "access" ? "Cadastro e acesso" : "Apresentação da proposta"}</DialogTitle><DialogDescription>{open === 'workspace' ? 'Confira as informações antes de liberar o link ao proprietário.' : open === "access" ? "Convite exclusivo deste imóvel. Compartilhe somente com o proprietário." : "Link separado, sem permissão para confirmar ou editar o cadastro."}</DialogDescription></DialogHeader>
        <div className="min-h-0 min-w-0 overflow-y-auto">
          <SectionBoundary key={open} label="os links do proprietário">
            {open === 'workspace' ? <OwnerWorkspaceLinkPanel implementationId={implementation.id}/> : open === "access" ? <OwnerPortalPanel implementationId={implementation.id} ownerId={implementation.ownerId} ownerName={ownerName} compact /> : open === "presentation" ? <OwnerInviteSection implementationId={implementation.id} ownerName={ownerName} /> : null}
          </SectionBoundary>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}