import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Check, Copy, FileCheck, QrCode, Upload } from "lucide-react";
import { preparePayoutPayment, finalizePayoutPayment, listPayoutReceipts } from "@/lib/api/core-client";
import type { PayoutPaymentRequest } from "@/types/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const money = (cents: number) => (cents/100).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
export function PayoutPaymentPanel({ implementationId, competence, balance, complete, onSaved }: { implementationId: string; competence: string; balance: number; complete: boolean; onSaved: () => void }) {
  const prepare = useServerFn(preparePayoutPayment), finalize = useServerFn(finalizePayoutPayment), read = useServerFn(listPayoutReceipts);
  const qc = useQueryClient();
  const receipts = useQuery({ queryKey:["payout-receipts",implementationId,competence],queryFn:()=>read({ data:{implementationId,competence} }) });
  const [payment,setPayment] = useState<{ request:PayoutPaymentRequest; code:string } | null>(null);
  const [qr,setQr] = useState("");
  const [busy,setBusy] = useState(false);
  const [file,setFile] = useState<File | null>(null);
  const [amount,setAmount] = useState("");
  const [paidOn,setPaidOn] = useState(new Date().toISOString().slice(0,10));
  const [confirmed,setConfirmed] = useState(false);
  useEffect(()=> { if (!payment) { setQr(""); return; } let active=true; QRCode.toDataURL(payment.code,{width:256,margin:2,errorCorrectionLevel:"M"}).then(url=>{if(active)setQr(url);}).catch(()=>toast.error("Não foi possível desenhar o QR Code.")); return ()=>{active=false;}; },[payment]);
  useEffect(()=>{setPayment(null);},[implementationId,competence]);
  const open = async () => {
    setBusy(true);
    try { const result=await prepare({data:{implementationId,competence}}); setPayment(result); setAmount((Number(result.request.amount_cents)/100).toFixed(2)); setFile(null); setConfirmed(false); }
    catch(e){toast.error(e instanceof Error?e.message:"Não foi possível preparar o Pix.");} finally {setBusy(false);}
  };
  const save = async () => {
    if (!payment || !file || !confirmed) return;
    setBusy(true);
    const form=new FormData(); form.set("requestId",payment.request.id); form.set("amount",String(Math.round(Number(amount)*100))); form.set("paidOn",paidOn); form.set("confirmed","true"); form.set("file",file);
    try { await finalize({data:form}); toast.success("Repasse registrado com comprovante."); setPayment(null); await qc.invalidateQueries({queryKey:["payout-receipts",implementationId,competence]}); onSaved(); }
    catch(e){toast.error(e instanceof Error?e.message:"Não foi possível finalizar o repasse.");} finally {setBusy(false);}
  };
  return <div className="payout-payment-panel">
    <Button className="payout-primary" disabled={!complete || balance<=0 || busy || receipts.isError} onClick={open}><QrCode size={17}/>{busy?"Preparando…":"Pagar com Pix"}</Button>
    {receipts.isError && <p role="alert" className="mt-2 text-sm text-destructive">Acesso financeiro restrito ou comprovantes indisponíveis.</p>}
    {receipts.data && receipts.data.length>0 && <div className="mt-3 grid gap-2">{receipts.data.map(receipt=><a key={receipt.id} href={receipt.url} target="_blank" rel="noreferrer" className="admin-inline-link"><FileCheck size={16}/>{receipt.name}</a>)}</div>}
    <Dialog open={!!payment} onOpenChange={open=>{if(!open&&!busy)setPayment(null);}}><DialogContent className="max-w-xl max-h-[calc(100dvh-32px)] overflow-y-auto"><DialogHeader><DialogTitle>Repasse por Pix</DialogTitle><DialogDescription>{payment?.request.snapshot.recipient.name} · {competence}</DialogDescription></DialogHeader>
      {payment && <div className="grid gap-4">
        <div className="payout-pix-summary"><div>{qr?<img src={qr} width={200} height={200} alt="QR Code Pix do repasse"/>:<div className="size-48 animate-pulse bg-muted"/>}</div><div className="min-w-0"><p className="text-sm text-muted-foreground">Saldo a repassar</p><p className="text-2xl font-semibold">{money(Number(payment.request.amount_cents))}</p><p className="mt-3 break-all text-sm">{payment.request.snapshot.recipient.pixKey}</p><Button variant="outline" className="mt-3" onClick={async()=>{try{await navigator.clipboard.writeText(payment.code);toast.success("Código Pix copiado.");}catch{toast.error("Não foi possível copiar.");}}}><Copy size={16}/>Copiar código Pix</Button></div></div>
        <div className="border-t pt-4"><h3 className="flex items-center gap-2 font-semibold"><Check size={17}/>Finalizar repasse</h3><div className="mt-3 grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm">Valor pago (R$)<Input type="number" min="0.01" max={Number(payment.request.amount_cents)/100} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="grid gap-1 text-sm">Data do pagamento<Input type="date" max={new Date().toISOString().slice(0,10)} value={paidOn} onChange={e=>setPaidOn(e.target.value)}/></label></div>
          <label className="mt-3 grid gap-2 text-sm"><span className="flex items-center gap-2"><Upload size={16}/>Comprovante · PDF, JPG ou PNG · até 10 MB</span><Input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
          <label className="mt-3 flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={value=>setConfirmed(value===true)}/><span>Confirmo que o pagamento foi realizado ao titular acima.</span></label>
          <Button className="mt-4 w-full payout-primary" disabled={busy||!confirmed||!file||file.size>10*1024*1024||Number(amount)<=0||Number(amount)>Number(payment.request.amount_cents)/100||!paidOn} onClick={save}><FileCheck size={17}/>{busy?"Salvando…":"Finalizar e salvar comprovante"}</Button>
        </div>
      </div>}
    </DialogContent></Dialog>
  </div>;
}