import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Mail, Plus, X, ChevronDown, Building2, Users, ShieldCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { implementationQuery, ownerOnboardingSubmissionQuery } from "@/lib/api/queries";
import { exportAuthorizationLetter } from "@/lib/contract-document.functions";
import { authorizationLetterSchema, defaultLetterExtras, formatLetterDocuments, type AuthorizationLetterFields } from "@/lib/authorization-letter";
import { formatBrazilianDocument } from "@/lib/owner-form-validation";

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return <div className="space-y-2"><Label>{label}</Label>
    {items.map((item, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Input aria-label={`${label} ${i + 1}`} value={formatLetterDocuments(item)} placeholder={placeholder} onChange={e => onChange(items.map((v, j) => j === i ? formatLetterDocuments(e.target.value) : v))} /><Button type="button" size="icon" variant="ghost" aria-label={`Remover ${label} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}><X className="size-4" /></Button></div>)}
    <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])}><Plus className="size-4" />Incluir</Button></div>;
}

export function AuthorizationLetterDialog({ implementationId }: { implementationId: string }) {
  const [open, setOpen] = useState(false);
  const project = useQuery({ ...implementationQuery(implementationId), enabled: open });
  const owner = useQuery({ ...ownerOnboardingSubmissionQuery(implementationId), enabled: open, refetchInterval: false });
  const [f, setF] = useState<AuthorizationLetterFields | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<{ word: Blob; pdf: Blob; filename: string } | null>(null);
  const generate = useServerFn(exportAuthorizationLetter);
  const set = (patch: Partial<AuthorizationLetterFields>) => { setFiles(null); setF(cur => cur && { ...cur, ...patch }); };

  if (open && !f && project.data && !owner.isPending && !owner.isError) {
    const p = project.data, o = owner.data;
    const people = o?.people?.length ? o.people : o ? [{ fullName: o.fullName, document: o.document }] : [];
    const city = (p.city ?? "").toLowerCase().includes("canela") ? "Canela/RS" : "Gramado/RS";
    setF({
      owners: people.length ? people.map(x => ({ name: x.fullName ?? "", cpf: formatBrazilianDocument(x.document ?? "") })) : [{ name: "", cpf: "" }],
      gender: "m", unit: p.unit ?? "", tower: p.tower ?? "", condominium: p.condominiumName ?? "",
      address: [p.address, p.city, p.postalCode && `CEP ${p.postalCode}`].filter(Boolean).join(" – "),
      city, date: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }), ...defaultLetterExtras,
      representatives: [...defaultLetterExtras.representatives], vehicles: [...defaultLetterExtras.vehicles],
    });
  }
  const clean = f && { ...f, representatives: f.representatives.filter(s => s.trim()), vehicles: f.vehicles.filter(s => s.trim()) };
  const valid = clean ? authorizationLetterSchema.safeParse(clean) : null;
  const issues = valid && !valid.success ? [...new Set(valid.error.issues.map(i => String(i.path[0])))] : [];
  const labels: Record<string, string> = { owners: "nome/CPF do proprietário", unit: "apartamento", tower: "torre", condominium: "condomínio", address: "endereço", city: "cidade", date: "data", contact: "contato" };

  const prepare = async () => {
    if (!valid?.success) return;
    setBusy(true); setError(null);
    try {
      const r = await generate({ data: { implementationId, fields: valid.data } });
      const { generateAuthorizationLetterPdf } = await import('@/lib/pdf/authorization-letter-pdf');
      const pdf = await generateAuthorizationLetterPdf(valid.data);
      setFiles({ word: new Blob([Uint8Array.from(atob(r.base64), c => c.charCodeAt(0))], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), pdf: new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), filename: r.filename });
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível gerar a carta."); } finally { setBusy(false); }
  };
  const download = (format: 'word' | 'pdf') => {
    if (!files) return;
    const url = URL.createObjectURL(files[format]); const a = document.createElement('a'); a.href = url; a.download = format === 'word' ? files.filename : files.filename.replace(/\.docx$/i, '.pdf'); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return <>
    <Button variant="outline" onClick={() => { setF(null); setFiles(null); setError(null); setOpen(true); }}><Mail className="size-4" />Carta à portaria</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-3xl flex-col overflow-hidden rounded-lg p-0">
        <DialogHeader className="shrink-0 border-b border-border bg-muted/30 px-5 py-5 pr-12 text-left sm:px-7 sm:py-6 sm:pr-12"><div className="flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Mail className="size-5" /></span><div className="min-w-0"><DialogTitle className="text-lg text-primary sm:text-xl">Carta de autorização à portaria</DialogTitle><DialogDescription className="mt-1 flex flex-wrap items-center gap-x-2">{project.data?.condominiumName} · Apartamento {project.data?.unit}</DialogDescription></div></div></DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
        {!f ? <p className="text-sm text-muted-foreground">{project.isError || owner.isError ? "Não foi possível carregar a ficha." : "Carregando…"}</p> : <fieldset disabled={busy} className="min-w-0 space-y-5">
          <section className="space-y-4"><h3 className="flex items-center gap-2 font-semibold text-primary"><Users className="size-4" />Proprietário(s)<span className="ml-auto text-xs font-normal text-muted-foreground">{f.owners.length === 1 ? "1 proprietário" : `${f.owners.length} proprietários`}</span></h3>
            {f.owners.map((o, i) => <div key={i} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border/60 pb-4 sm:grid-cols-[minmax(0,1fr)_11rem_auto]"><div className="col-start-1 min-w-0 space-y-1.5"><Label htmlFor={`letter-owner-${i}`}>Nome completo</Label><Input id={`letter-owner-${i}`} aria-label="Nome" placeholder="Nome completo" value={o.name} onChange={e => set({ owners: f.owners.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} /></div><div className="col-start-1 min-w-0 space-y-1.5 sm:col-start-2"><Label htmlFor={`letter-cpf-${i}`}>CPF</Label><Input id={`letter-cpf-${i}`} className="tabular-nums" aria-label="CPF" placeholder="000.000.000-00" inputMode="numeric" maxLength={14} value={formatBrazilianDocument(o.cpf)} onChange={e => set({ owners: f.owners.map((x, j) => j === i ? { ...x, cpf: formatBrazilianDocument(e.target.value.replace(/\D/g, '').slice(0, 11)) } : x) })} /></div><Button className="col-start-2 row-start-1 self-end sm:col-start-3" size="icon" variant="ghost" title="Remover proprietário" aria-label="Remover" disabled={f.owners.length < 2} onClick={() => set({ owners: f.owners.filter((_, j) => j !== i) })}><X className="size-4" /></Button></div>)}
            <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => set({ owners: [...f.owners, { name: "", cpf: "" }] })}><Plus className="size-4" />Incluir proprietário</Button>
              {f.owners.length === 1 && <Select value={f.gender} onValueChange={v => set({ gender: v as "m" | "f" })}><SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="m">Proprietário</SelectItem><SelectItem value="f">Proprietária</SelectItem></SelectContent></Select>}</div>
          </section>
          <details className="group border-t border-border pt-1"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-4 text-sm font-semibold text-primary transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"><span className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-primary"><Building2 className="size-4" /></span><span>Imóvel e assinatura<span className="mt-1 block text-xs font-normal text-muted-foreground">{f.condominium} · {f.unit}{f.tower && ` · ${f.tower}`}</span></span></span><ChevronDown className="size-4 shrink-0 transition-transform motion-reduce:transition-none group-open:rotate-180" /></summary><section className="mt-2 grid gap-3 pb-4 sm:grid-cols-2">
            <div className="space-y-1"><Label>Apartamento</Label><Input value={f.unit} onChange={e => set({ unit: e.target.value })} /></div>
            <div className="space-y-1"><Label>Torre</Label><Input value={f.tower} onChange={e => set({ tower: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Condomínio</Label><Input value={f.condominium} onChange={e => set({ condominium: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Endereço</Label><Input value={f.address} onChange={e => set({ address: e.target.value })} /></div>
            <div className="space-y-1"><Label>Cidade da assinatura</Label><Input value={f.city} onChange={e => set({ city: e.target.value })} /></div>
            <div className="space-y-1"><Label>Data</Label><Input type="date" value={f.date} onChange={e => set({ date: e.target.value })} /></div>
          </section></details>
          <details className="group border-t border-border pt-1"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-4 text-sm font-semibold text-primary transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"><span className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-primary"><ShieldCheck className="size-4" /></span><span>Dados padrão STAYO<span className="mt-1 block text-xs font-normal text-muted-foreground">{f.representatives.length} autorizados · {f.vehicles.length} veículos · contato STAYO</span></span></span><ChevronDown className="size-4 shrink-0 transition-transform motion-reduce:transition-none group-open:rotate-180" /></summary><div className="mt-2 space-y-4 pb-4">
          <ListEditor label="Autorizados a representar" items={f.representatives} placeholder="Nome – CPF" onChange={v => set({ representatives: v })} />
          <ListEditor label="Veículos (placas)" items={f.vehicles} placeholder="ABC-1D23" onChange={v => set({ vehicles: v })} />
          <div className="space-y-1"><Label>Contato</Label><Input value={f.contact} onChange={e => set({ contact: e.target.value })} /></div>
          </div></details>
        </fieldset>}
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t border-border bg-muted/30 px-5 py-4 sm:flex-wrap sm:px-7">
          {issues.length > 0 && <p role="alert" className="mr-auto text-xs text-destructive">Falta: {issues.map(i => labels[i] ?? i).join(", ")}</p>}
          {error && <p role="alert" className="mr-auto text-xs text-destructive">{error}</p>}
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Fechar</Button>
          {files ? <><Button variant="outline" onClick={() => download('word')}><Download className="size-4" />Baixar Word</Button><Button onClick={() => download('pdf')}><Download className="size-4" />Baixar PDF</Button></> : <Button disabled={!valid?.success || busy} onClick={() => void prepare()}>{busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <FileText className="size-4" />}{busy ? 'Preparando…' : 'Preparar documentos'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
