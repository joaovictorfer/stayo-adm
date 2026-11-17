import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, FileText, Loader2, Pencil, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { contractRowToSnapshot } from "@/lib/contract-conditions";
import { buildContractCopy, copyContractToClipboard, type ContractCopyInput } from "@/lib/contract-copy";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminCondominiumsListQuery } from "@/lib/api/queries";
import type { ImplementationProject } from "@/types/core";
import type { OwnerOnboardingSubmission } from "@/types/owner-onboarding";
import type { PropertyDetails } from "@/lib/api/owner-portal-data";
import { ContractSummaryEditor } from './ContractSummaryEditor';
import { ContractPersonForm } from './ContractPersonEditor';
import { OwnerAddressEditor } from './OwnerAddressEditor';
import { PixEditor } from './OwnerQuickEditors';
import { ContractPropertyEditor } from './ContractPropertyEditor';

export function ContractCopyDialog({ implementation, submission, official, details, loading }: {
  implementation: ImplementationProject; submission: OwnerOnboardingSubmission | null | undefined;
  official?: { name?: string | null; document?: string | null; email?: string | null; phone?: string | null } | null | undefined;
  details: PropertyDetails | null | undefined; loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<'people' | 'conditions' | 'property' | null>(null);
  const [conditionFocus, setConditionFocus] = useState<string | undefined>();
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (editing) contentRef.current?.scrollTo({ top: 0 }); }, [editing]);
  const editConditions = (field?: string) => { setConditionFocus(field); setEditing('conditions'); };
  const conditions = useQuery({ queryKey: ["contract-copy-conditions", implementation.id], enabled: open, staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("implementation_contract_conditions").select("*").eq("implementation_id", implementation.id).maybeSingle();
      if (error) throw error;
      return contractRowToSnapshot(data);
    },
  });
  const condos = useQuery({ ...adminCondominiumsListQuery(), enabled: open });
  const condo = condos.data?.find(item => item.id === implementation.condominiumId);
  const sub = submission;
  const people: ContractCopyInput["people"] = sub?.people.length ? sub.people.map((person, index) => ({
    name: index === 0 ? official?.name || person.fullName : person.fullName,
    document: index === 0 ? official?.document || person.document : person.document,
    maritalStatus: person.maritalStatus, profession: person.profession, email: person.email, phone: person.phone,
  })) : [{ name: official?.name || sub?.fullName || implementation.ownerName || "", document: official?.document || sub?.document || "",
    email: official?.email || sub?.email || "", phone: official?.phone || sub?.phone || "" }];
  const document = buildContractCopy({ people,
    ownerAddress: { street: sub?.street, number: sub?.number, complement: sub?.complement, district: sub?.district, city: sub?.city, state: sub?.state, postalCode: sub?.postalCode },
    property: { unit: implementation.unit, tower: implementation.tower, condominium: implementation.condominiumName,
      street: details?.street || condo?.address || implementation.address, number: details?.number, complement: details?.complement,
      district: details?.district || condo?.neighborhood, city: details?.city || condo?.city || implementation.city,
      state: details?.state || condo?.state, postalCode: details?.postalCode || condo?.postalCode || implementation.postalCode },
    conditions: conditions.data ?? {}, pixKey: sub?.pixKey,
  }, sensitive);
  const unavailable = conditions.isPending || conditions.isFetching || condos.isPending || condos.isError || conditions.isError || loading;
  async function copy(part: "all" | "people" | "summary") {
    setBusy(true);
    try {
      const result = await copyContractToClipboard(part === "people" ? document.contractorsHtml : part === "summary" ? document.summaryHtml : document.html,
        part === "people" ? document.contractorsText : part === "summary" ? document.summaryText : document.text);
      toast.success(result === "formatted" ? "Copiado com formatação para Word" : "Texto copiado; este navegador não permitiu copiar a formatação.");
    } catch { toast.error("Não foi possível copiar. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="outline" size="sm" disabled={loading} onClick={() => setOpen(true)}><FileText />Dados para contrato</Button>
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) { setSensitive(false); setEditing(null); } }}>
      <DialogContent ref={contentRef} className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Dados para contrato</DialogTitle><DialogDescription>{implementation.nickname || implementation.condominiumName} · {implementation.unit} · {implementation.code}</DialogDescription></DialogHeader>
        {!editing && <label className="flex items-center gap-2 text-sm"><Checkbox checked={sensitive} onCheckedChange={value => setSensitive(value === true)} />Incluir CPF/CNPJ e chave Pix completos</label>}
        {document.hasMissing && !unavailable && <p role="status" className="text-sm text-muted-foreground">Campos sem informação e cláusulas não cadastradas estão marcados como [A DEFINIR].</p>}
        {unavailable ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">{conditions.isError || condos.isError ? <>Não foi possível carregar os dados.<Button variant="link" onClick={() => { void conditions.refetch(); void condos.refetch(); }}>Tentar novamente</Button></> : <><Loader2 className="size-4 animate-spin" />Carregando dados do contrato…</>}</p> : <>
          {editing ? <div className="space-y-5">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}><ArrowLeft />Voltar ao resumo</Button>
            {editing === 'property' ? <ContractPropertyEditor project={implementation} address={{ street: details?.street || condo?.address || implementation.address, number: details?.number, complement: details?.complement, district: details?.district || condo?.neighborhood, city: details?.city || condo?.city || implementation.city, state: details?.state || condo?.state, postalCode: details?.postalCode || condo?.postalCode || implementation.postalCode }} onDone={() => setEditing(null)} /> : editing === 'conditions' ? <ContractSummaryEditor implementationId={implementation.id} initial={conditions.data ?? {}} focusField={conditionFocus} onDone={() => setEditing(null)} /> : <>
              {people.map((person, index) => <section key={index} className="space-y-3 border-b border-border pb-4"><h3 className="font-semibold">{index === 0 ? 'Titular' : `Contratante ${index + 1}`}</h3><ContractPersonForm implementationId={implementation.id} position={index} initial={{ fullName: person.name, document: person.document, email: person.email ?? null, phone: person.phone ?? null, maritalStatus: person.maritalStatus ?? null, profession: person.profession ?? null, role: sub?.people[index]?.role ?? null }} onDone={() => setEditing(null)} /></section>)}
              <section className="space-y-3"><h3 className="font-semibold">Endereço do proprietário</h3><OwnerAddressEditor implementationId={implementation.id} initial={{ postalCode: sub?.postalCode ?? '', street: sub?.street ?? '', number: sub?.number ?? '', complement: sub?.complement ?? '', district: sub?.district ?? '', city: sub?.city ?? '', state: sub?.state ?? '' }} onDone={() => setEditing(null)} /></section>
              <section className="space-y-3"><h3 className="font-semibold">Chave Pix</h3><PixEditor implementationId={implementation.id} initialType={sub?.pixType} initialKey={sub?.pixKey} /></section>
            </>}
          </div> : <><section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">CONTRATANTE(S)</h3><div className="flex flex-wrap gap-1"><Button variant="outline" size="sm" onClick={() => setEditing('people')}><Pencil />Editar cadastro</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => void copy("people")}><Copy />Copiar contratantes</Button></div></div>
            {document.qualifications.map((text, index) => <p key={index} className="text-sm leading-relaxed">{text}</p>)}
          </section>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold underline">QUADRO RESUMO</h3><div className="flex flex-wrap gap-1"><Button variant="outline" size="sm" onClick={() => editConditions()}><Pencil />Editar condições</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => void copy("summary")}><Copy />Copiar quadro resumo</Button></div></div>
            <div className="overflow-hidden rounded-lg border border-border">{document.rows.map((row, index) => <div key={row.title} className="border-b border-border px-3 py-2 last:border-b-0"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><h4 className="min-w-0 text-sm font-semibold">{row.title}</h4><Button variant="ghost" size="sm" className="shrink-0" aria-label={`Editar ${row.title}`} onClick={() => index === 0 ? setEditing('property') : editConditions(['', 'administration_fee', 'turnover_cleaning_fee', 'administration_fee', 'payout_rule', 'owner_use_notes', 'marketing_rule', 'maintenance_limit', 'periodic_shutdown_rule', 'duration_months'][index])}><Pencil className="size-4" /><span className="hidden sm:inline">Editar</span></Button></div><p className="whitespace-pre-line text-sm leading-relaxed">{row.body}</p></div>)}</div>
          </section></>}
        </>}
        {!editing && <div className="flex justify-end"><Button disabled={busy || unavailable} onClick={() => void copy("all")}><Copy />Copiar tudo para Word</Button></div>}
      </DialogContent>
    </Dialog>
  </>;
}