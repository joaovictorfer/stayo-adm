import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ContractReview } from "./ContractReview";
import { implementationQuery, ownerOnboardingSubmissionQuery } from "@/lib/api/queries";
import { exportStandardContract } from "@/lib/contract-document.functions";
import { buildQualification, contractFieldsSchema, initialContractParties, type ContractParty, type PreparedContractFields } from "@/lib/contract-preparation";

export function ContractDocumentDialog({ implementationId, conditions }: { implementationId: string; conditions: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false);
  const project = useQuery({ ...implementationQuery(implementationId), enabled: open });
  const owner = useQuery({ ...ownerOnboardingSubmissionQuery(implementationId), enabled: open, refetchInterval: false });
  const [fields, setFields] = useState<PreparedContractFields | null>(null);
  const [busy, setBusy] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [file, setFile] = useState<{ blob: Blob; filename: string } | null>(null);
  const revision = useRef(0);
  const generate = useServerFn(exportStandardContract);
  const initialize = () => {
    const p = project.data;
    const o = owner.data;
    if (!p || !o) return;
    const people = initialContractParties(o);
    const propertyAddress = [p.address, p.city, p.postalCode && `CEP ${p.postalCode}`].filter(Boolean).join(" – ");
    setFields({
      parties: people, qualification: buildQualification(people),
      propertyDescription: [`Apartamento nº ${p.unit ?? ""}`, p.tower && `Torre ${p.tower}`, p.condominiumName && `localizado no ${p.condominiumName}`, propertyAddress && `situado na ${propertyAddress}`].filter(Boolean).join(", ") + ".",
      pixKey: o.pixKey, signatureNames: people.map(person => person.fullName.toUpperCase()).join(" / "),
      signatureCity: "Gramado/RS", signatureDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
      administrationFee: Number(conditions?.["administration_fee"] ?? 20), durationMonths: Number(conditions?.["duration_months"] ?? 12),
      maintenanceLimit: Number(conditions?.["maintenance_limit"] ?? 300), noticePeriodDays: Number(conditions?.["notice_period_days"] ?? 30),
      ownerUseNoticeDays: Number(conditions?.["owner_use_notice_days"] ?? 3), exclusivity: conditions?.["exclusivity"] !== false, implementationFee: Number(conditions?.["implementation_fee"] ?? 600),
      payoutMode: conditions?.["payout_mode"] === "platform_auto" ? "platform_auto" : "day10_report",
      witness1Name: "Luana Lima de Oliveira", witness1Cpf: "114.011.974-50", witness2Name: "", witness2Cpf: "",
    });
    setFile(null);
    setDirty(false);
    setReviewing(false);
  };
  const change = <K extends keyof PreparedContractFields>(key: K, value: PreparedContractFields[K]) => { if (busy) return; revision.current++; setDirty(true); setFields(f => f ? { ...f, [key]: value } : f); setFile(null); };
  const validation = fields ? contractFieldsSchema.safeParse(fields) : null;
  const issues = validation && !validation.success ? validation.error.issues : [];
  const fieldError = (path: string) => issues.find(issue => issue.path.join(".") === path)?.message;
  const changeParty = (index: number, key: keyof ContractParty, value: string) => {
    if (!fields || busy) return;
    const parties = fields.parties.map((p, i) => i === index ? { ...p, [key]: value } : p);
    revision.current++; setDirty(true); setFields({ ...fields, parties, qualification: buildQualification(parties), signatureNames: parties.map(p => p.fullName.trim().toUpperCase()).join(" / ") }); setFile(null);
  };
  const discard = () => { revision.current++; setFile(null); setFields(null); setDirty(false); setReviewing(false); setConfirmClose(false); setOpen(false); };
  const closeDialog = (value: boolean) => {
    if (value) { setOpen(true); return; }
    if (busy) return;
    if (dirty) { setConfirmClose(true); return; }
    discard();
  };
  const prepare = async () => {
    if (!fields || !validation?.success) return;
    const rev = ++revision.current;
    const snapshot = validation.data;
    setPrepareError(null);
    setBusy(true);
    try {
      const result = await generate({ data: { implementationId, fields: snapshot } });
      if (rev !== revision.current) return;
      const bytes = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0));
      setFile({ blob: new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), filename: result.filename });
    } catch (e) {
      if (rev === revision.current) {
        const message = e instanceof Error ? e.message : "";
        setPrepareError(/fetch|network|load failed/i.test(message) || !message ? "Não foi possível preparar o contrato. Verifique sua conexão e tente novamente." : message);
      }
    }
    finally { setBusy(false); }
  };
  const download = () => {
    if (!file) return;
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement("a"); a.href = url; a.download = file.filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  return <>
    <Button variant="outline" onClick={() => { revision.current++; setOpen(true); setFields(null); setFile(null); setDirty(false); setReviewing(false); setPrepareError(null); }}><FileText className="size-4" />Gerar contrato</Button>
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="flex max-w-3xl max-h-[90dvh] flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-12"><DialogTitle>Contrato · minuta padrão STAYO</DialogTitle><DialogDescription>{file ? "Documento preparado" : reviewing ? "Conferência final" : "Dados do contrato"}</DialogDescription></DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {!fields ? <div className="space-y-3">
          {project.isPending || owner.isPending ? <p>Carregando cadastro…</p> : project.isError || owner.isError ? <p role="alert">Não foi possível carregar o cadastro.</p> : !owner.data ? <p role="alert">Complete o cadastro do proprietário antes de gerar o contrato.</p> : <Button onClick={initialize}>Conferir dados do cadastro</Button>}
        </div> : reviewing && validation?.success ? <ContractReview fields={validation.data} /> : <fieldset disabled={busy} className="space-y-5">
          <h3 className="font-semibold">Contratantes</h3>
          {fields.parties.map((person, index) => <section key={index} className="space-y-3 border-b border-border pb-4">
            <h4 className="text-sm font-medium">{index === 0 ? "Titular" : `Contratante ${index + 1}`}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {([['fullName','Nome completo / Razão social'],['document',person.personType === 'pj' ? 'CNPJ' : 'CPF do contratante'],['email','E-mail'],['phone','Telefone com DDD'],...(person.personType === 'pf' ? [['maritalStatus','Estado civil'],['profession','Profissão']] : [['representative','Representante legal — qualificação']]),['address','Endereço completo']] as [keyof ContractParty,string][]).map(([key,label]) => {
                const error = fieldError(`parties.${index}.${key}`);
                const id = `contract-party-${index}-${key}`;
                return <div key={key} className={`space-y-1 ${key === 'address' || key === 'representative' ? 'sm:col-span-2' : ''}`}><Label htmlFor={id}>{label}</Label><Input id={id} value={person[key]} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={e => changeParty(index,key,e.target.value)} />{error && <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>}</div>;
              })}
            </div>
          </section>)}
          <div className="space-y-1"><Label htmlFor="contract-qualification">Qualificação no contrato</Label><Textarea id="contract-qualification" value={fields.qualification} readOnly rows={4} /></div>
          <h3 className="border-t border-border pt-5 font-semibold">Imóvel</h3>
          <div className="space-y-1"><Label htmlFor="contract-propertyDescription">Imóvel objeto</Label><Textarea id="contract-propertyDescription" aria-invalid={!!fieldError('propertyDescription')} value={fields.propertyDescription} onChange={e => change('propertyDescription',e.target.value)} rows={3} />{fieldError('propertyDescription') && <p className="text-xs text-destructive">{fieldError('propertyDescription')}</p>}</div>
          <h3 className="border-t border-border pt-5 font-semibold">Condições comerciais</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="contract-pixKey">Chave Pix</Label><Input id="contract-pixKey" aria-invalid={!!fieldError('pixKey')} value={fields.pixKey} onChange={e => change('pixKey',e.target.value)} />{fieldError('pixKey') && <p className="text-xs text-destructive">{fieldError('pixKey')}</p>}</div>
            {([['administrationFee','Administração (%)'],['durationMonths','Vigência (meses)'],['maintenanceLimit','Manutenção emergencial (R$)'],['noticePeriodDays','Rescisão (dias)'],['ownerUseNoticeDays','Antecedência de uso (dias)'],['implementationFee','Implantação (R$)']] as const).map(([key,label]) => <div key={key} className="space-y-1"><Label htmlFor={`contract-${key}`}>{label}</Label><Input id={`contract-${key}`} type="number" min="0" step={key === 'implementationFee' || key === 'maintenanceLimit' || key === 'administrationFee' ? '0.01' : '1'} aria-invalid={!!fieldError(key)} value={fields[key]} onChange={e => change(key,Number(e.target.value))} />{fieldError(key) && <p className="text-xs text-destructive">{fieldError(key)}</p>}</div>)}
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="contract-payout">Repasse</Label><Select disabled={busy} value={fields.payoutMode} onValueChange={value => change('payoutMode',value === 'platform_auto' ? 'platform_auto' : 'day10_report')}><SelectTrigger id="contract-payout"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="platform_auto">Automático, com alternativa até dia 10</SelectItem><SelectItem value="day10_report">STAYO até dia 10, com relatório</SelectItem></SelectContent></Select></div>
            <div className="flex items-center justify-between gap-3 sm:col-span-2"><Label htmlFor="contract-exclusivity">Exclusividade</Label><Switch id="contract-exclusivity" disabled={busy} checked={fields.exclusivity} onCheckedChange={value => change('exclusivity',value)} /></div>
          </div>
          <h3 className="border-t border-border pt-5 font-semibold">Assinaturas e testemunhas</h3>
          <div className="grid gap-3 sm:grid-cols-2">{([['signatureNames','Nome(s) na assinatura'],['signatureCity','Local'],['signatureDate','Data']] as const).map(([key,label]) => <div key={key} className={`space-y-1 ${key === 'signatureNames' ? 'sm:col-span-2' : ''}`}><Label htmlFor={`contract-${key}`}>{label}</Label><Input id={`contract-${key}`} readOnly={key === 'signatureNames'} aria-invalid={!!fieldError(key)} type={key === 'signatureDate' ? 'date' : 'text'} value={fields[key]} onChange={e => change(key,e.target.value)} />{fieldError(key) && <p className="text-xs text-destructive">{fieldError(key)}</p>}</div>)}</div>
          <div className="grid gap-3 sm:grid-cols-2">{([['witness1Name','Primeira testemunha'],['witness1Cpf','CPF'],['witness2Name','Segunda testemunha'],['witness2Cpf','CPF da segunda testemunha']] as const).map(([key,label]) => <div key={key} className="space-y-1"><Label htmlFor={`contract-${key}`}>{label}</Label><Input id={`contract-${key}`} aria-invalid={!!fieldError(key)} value={fields[key]} onChange={e => change(key,e.target.value)} />{fieldError(key) && <p className="text-xs text-destructive">{fieldError(key)}</p>}</div>)}</div>
          {issues.length > 0 && <p role="alert" className="text-sm text-destructive">Há {issues.length} {issues.length === 1 ? 'dado pendente' : 'dados pendentes'} para conferir.</p>}
        </fieldset>}
        </div>
        {prepareError && <p role="alert" className="shrink-0 border-t border-border px-6 py-3 text-sm text-destructive">{prepareError}</p>}
        <DialogFooter className="shrink-0 gap-2 border-t border-border bg-background px-6 py-4"><Button variant="outline" disabled={busy} onClick={() => closeDialog(false)}>Fechar</Button>{reviewing && <Button variant="outline" disabled={busy} onClick={() => { setReviewing(false); setPrepareError(null); }}><ArrowLeft className="size-4" />Editar dados</Button>}{file ? <Button onClick={download}><Download className="size-4" />Baixar Word</Button> : fields && (reviewing ? <Button disabled={!validation?.success || busy} onClick={() => void prepare()}>{busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}{busy ? "Preparando…" : "Preparar contrato"}</Button> : <Button disabled={!validation?.success || busy} onClick={() => setReviewing(true)}>Revisar contrato<ArrowRight className="size-4" /></Button>)}</DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}><AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-lg"><AlertDialogHeader><AlertDialogTitle>Descartar alterações do contrato?</AlertDialogTitle><AlertDialogDescription>Os dados ajustados nesta conferência não foram salvos. Ao sair, essas alterações serão descartadas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Continuar conferência</AlertDialogCancel><AlertDialogAction onClick={discard}>Descartar e sair</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}