import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Mail, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { implementationQuery, ownerOnboardingSubmissionQuery } from "@/lib/api/queries";
import { exportAuthorizationLetter } from "@/lib/contract-document.functions";
import { authorizationLetterSchema, defaultLetterExtras, type AuthorizationLetterFields } from "@/lib/authorization-letter";

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return <div className="space-y-2"><Label>{label}</Label>
    {items.map((item, i) => <div key={i} className="flex gap-2"><Input value={item} placeholder={placeholder} onChange={e => onChange(items.map((v, j) => j === i ? e.target.value : v))} /><Button type="button" size="icon" variant="ghost" aria-label="Remover" onClick={() => onChange(items.filter((_, j) => j !== i))}><X className="size-4" /></Button></div>)}
    <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])}><Plus className="size-4" />Incluir</Button></div>;
}

export function AuthorizationLetterDialog({ implementationId }: { implementationId: string }) {
  const [open, setOpen] = useState(false);
  const project = useQuery({ ...implementationQuery(implementationId), enabled: open });
  const owner = useQuery({ ...ownerOnboardingSubmissionQuery(implementationId), enabled: open, refetchInterval: false });
  const [f, setF] = useState<AuthorizationLetterFields | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generate = useServerFn(exportAuthorizationLetter);
  const set = (patch: Partial<AuthorizationLetterFields>) => setF(cur => cur && { ...cur, ...patch });

  if (open && !f && project.data) {
    const p = project.data, o = owner.data;
    const people = o?.people?.length ? o.people : o ? [{ fullName: o.fullName, document: o.document }] : [];
    const city = (p.city ?? "").toLowerCase().includes("canela") ? "Canela/RS" : "Gramado/RS";
    setF({
      owners: people.length ? people.map(x => ({ name: x.fullName ?? "", cpf: x.document ?? "" })) : [{ name: "", cpf: "" }],
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

  const download = async () => {
    if (!valid?.success) return;
    setBusy(true); setError(null);
    try {
      const r = await generate({ data: { implementationId, fields: valid.data } });
      const blob = new Blob([Uint8Array.from(atob(r.base64), c => c.charCodeAt(0))], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = r.filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível gerar a carta."); } finally { setBusy(false); }
  };

  return <>
    <Button variant="outline" onClick={() => { setF(null); setError(null); setOpen(true); }}><Mail className="size-4" />Carta à portaria</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Carta de autorização à portaria</DialogTitle><DialogDescription>Confira os dados. O Word sai com o mesmo visual do contrato.</DialogDescription></DialogHeader>
        {!f ? <p className="text-sm text-muted-foreground">{project.isError ? "Não foi possível carregar a ficha." : "Carregando…"}</p> : <div className="space-y-5">
          <section className="space-y-2"><Label>Proprietário(s)</Label>
            {f.owners.map((o, i) => <div key={i} className="grid gap-2 sm:grid-cols-[1fr_11rem_auto]"><Input aria-label="Nome" placeholder="Nome completo" value={o.name} onChange={e => set({ owners: f.owners.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} /><Input aria-label="CPF" placeholder="CPF" value={o.cpf} onChange={e => set({ owners: f.owners.map((x, j) => j === i ? { ...x, cpf: e.target.value } : x) })} /><Button size="icon" variant="ghost" aria-label="Remover" disabled={f.owners.length < 2} onClick={() => set({ owners: f.owners.filter((_, j) => j !== i) })}><X className="size-4" /></Button></div>)}
            <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => set({ owners: [...f.owners, { name: "", cpf: "" }] })}><Plus className="size-4" />Incluir proprietário</Button>
              {f.owners.length === 1 && <Select value={f.gender} onValueChange={v => set({ gender: v as "m" | "f" })}><SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="m">Proprietário</SelectItem><SelectItem value="f">Proprietária</SelectItem></SelectContent></Select>}</div>
          </section>
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Apartamento</Label><Input value={f.unit} onChange={e => set({ unit: e.target.value })} /></div>
            <div className="space-y-1"><Label>Torre</Label><Input value={f.tower} onChange={e => set({ tower: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Condomínio</Label><Input value={f.condominium} onChange={e => set({ condominium: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Endereço</Label><Input value={f.address} onChange={e => set({ address: e.target.value })} /></div>
            <div className="space-y-1"><Label>Cidade da assinatura</Label><Input value={f.city} onChange={e => set({ city: e.target.value })} /></div>
            <div className="space-y-1"><Label>Data</Label><Input type="date" value={f.date} onChange={e => set({ date: e.target.value })} /></div>
          </section>
          <ListEditor label="Autorizados a representar" items={f.representatives} placeholder="Nome – CPF" onChange={v => set({ representatives: v })} />
          <ListEditor label="Veículos (placas)" items={f.vehicles} placeholder="ABC-1D23" onChange={v => set({ vehicles: v })} />
          <div className="space-y-1"><Label>Contato</Label><Input value={f.contact} onChange={e => set({ contact: e.target.value })} /></div>
        </div>}
        <DialogFooter className="flex-wrap items-center gap-2">
          {issues.length > 0 && <p role="alert" className="mr-auto text-xs text-destructive">Falta: {issues.map(i => labels[i] ?? i).join(", ")}</p>}
          {error && <p role="alert" className="mr-auto text-xs text-destructive">{error}</p>}
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          <Button disabled={!valid?.success || busy} onClick={() => void download()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Baixar Word</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
