import { localISODate } from "@/lib/local-date";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Check, Copy, FileCheck, QrCode, Upload, Wallet, CalendarDays, ArrowUpRight } from "lucide-react";
import { preparePayoutPayment, finalizePayoutPayment, listPayoutReceipts } from "@/lib/api/core-client";
import type { PayoutPaymentRequest } from "@/types/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput, MoneyCentsInput, parseMoneyText, formatMoneyText } from "@/components/ui/money-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const money = (cents: number) => (cents/100).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
export function PayoutPaymentPanel({ implementationId, competence, balance, complete, onSaved }: { implementationId: string; competence: string; balance: number; complete: boolean; onSaved: () => void }) {
  const prepare = useServerFn(preparePayoutPayment), finalize = useServerFn(finalizePayoutPayment), read = useServerFn(listPayoutReceipts);
  const qc = useQueryClient();
  const receipts = useQuery({ queryKey:["payout-receipts",implementationId,competence],queryFn:()=>read({ data:{implementationId,competence} }) });
  const [payment,setPayment] = useState<{ request:PayoutPaymentRequest; code:string; identification: { txid: string; description: string } } | null>(null);
  const [qr,setQr] = useState("");
  const [busy,setBusy] = useState(false);
  const [file,setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [amount,setAmount] = useState("");
  const [paidOn,setPaidOn] = useState(localISODate());
  const [confirmed,setConfirmed] = useState(false);
  useEffect(()=> { if (!payment) { setQr(""); return; } let active=true; QRCode.toDataURL(payment.code,{width:256,margin:2,errorCorrectionLevel:"M"}).then(url=>{if(active)setQr(url);}).catch(()=>toast.error("Não foi possível desenhar o QR Code.")); return ()=>{active=false;}; },[payment]);
  useEffect(()=>{setPayment(null);},[implementationId,competence]);
  // Colar (Ctrl+V) um print ou arquivo copiado anexa o comprovante, como no WhatsApp.
  useEffect(()=>{
    if (!payment) return;
    const onPaste=(e:ClipboardEvent)=>{
      const f=Array.from(e.clipboardData?.files??[]).find(x=>["application/pdf","image/jpeg","image/png"].includes(x.type));
      if (!f) { if (e.clipboardData?.files?.length) toast.error("Cole um PDF, JPG ou PNG."); return; }
      e.preventDefault();
      const named=f.name&&f.name!=="image.png"?f:new File([f],`comprovante-${localISODate()}.${f.type==="application/pdf"?"pdf":f.type==="image/png"?"png":"jpg"}`,{type:f.type});
      setFile(named); toast.success("Comprovante colado.");
    };
    window.addEventListener("paste",onPaste);
    return ()=>window.removeEventListener("paste",onPaste);
  },[payment]);
  const open = async () => {
    setBusy(true);
    try { const result=await prepare({data:{implementationId,competence}}); setPayment(result); setAmount(formatMoneyText(Number(result.request.amount_cents))); setFile(null); setConfirmed(false); }
    catch(e){toast.error(e instanceof Error?e.message:"Não foi possível preparar o Pix.");} finally {setBusy(false);}
  };
  const save = async () => {
    if (!payment || !file || !confirmed) return;
    setBusy(true);
    const form=new FormData(); form.set("requestId",payment.request.id); form.set("amount",String(parseMoneyText(amount)??0)); form.set("paidOn",paidOn); form.set("confirmed","true"); form.set("file",file);
    try { await finalize({data:form}); toast.success("Repasse registrado com comprovante."); setPayment(null); await qc.invalidateQueries({queryKey:["payout-receipts",implementationId,competence]}); onSaved(); }
    catch(e){toast.error(e instanceof Error?e.message:"Não foi possível finalizar o repasse.");} finally {setBusy(false);}
  };
  return <div className="payout-payment-panel">
    <Button className="payout-primary" disabled={!complete || balance<=0 || busy || receipts.isError} onClick={open}><QrCode size={17}/>{busy?"Preparando…":"Pagar com Pix"}</Button>
    {receipts.isError && <p role="alert" className="mt-2 text-sm text-destructive">Acesso financeiro restrito ou comprovantes indisponíveis.</p>}
    {receipts.data && receipts.data.length>0 && <div className="mt-3 grid gap-2">{receipts.data.map(receipt=><a key={receipt.id} href={receipt.url} target="_blank" rel="noreferrer" className="admin-inline-link"><FileCheck size={16}/>{receipt.name}</a>)}</div>}
    <Dialog open={!!payment} onOpenChange={open=>{if(!open&&!busy)setPayment(null);}}><DialogContent className="payout-pix-dialog"><DialogHeader className="payout-pix-header"><span className="payout-pix-heading-icon"><QrCode size={23}/></span><div className="min-w-0"><DialogTitle className="payout-pix-title">Repasse por Pix</DialogTitle><DialogDescription className="payout-pix-recipient">{payment?.request.snapshot.recipient.name}</DialogDescription></div></DialogHeader>
      {payment && <div className="payout-pix-body">
        <div className="payout-pix-summary"><div className="payout-pix-qr">{qr?<img src={qr} width={200} height={200} alt="QR Code Pix do repasse"/>:<div className="size-48 animate-pulse bg-muted"/>}</div><div className="payout-pix-details"><span className="payout-pix-period"><CalendarDays size={13}/>{new Date(`${competence}-01T12:00:00`).toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</span><p className="payout-pix-amount-label">Saldo a repassar <ArrowUpRight size={16}/></p><p className="payout-pix-amount">{money(Number(payment.request.amount_cents))}</p><div className="payout-pix-key"><span>Chave Pix</span><p>{payment.request.snapshot.recipient.pixKey}</p></div><Button variant="outline" className="payout-pix-copy" onClick={async()=>{try{await navigator.clipboard.writeText(payment.code);toast.success("Código Pix copiado.");}catch{toast.error("Não foi possível copiar.");}}}><Copy size={16}/>Copiar código Pix</Button></div></div>
        <div className="px-6 py-3 text-xs text-muted-foreground"><p className="break-all"><span className="font-semibold text-foreground">Identificador Pix: </span>{payment.identification.txid}</p><p className="mt-1 break-words">{payment.identification.description}</p></div>
        <div className="payout-pix-finalize"><h3 className="payout-pix-section-title"><span><Wallet size={18}/></span>Finalizar repasse</h3><div className="payout-pix-fields"><label className="grid gap-2 text-sm">Valor pago (R$)<MoneyInput value={amount} onValueChange={setAmount}/></label><label className="grid gap-2 text-sm">Data do pagamento<Input type="date" max={localISODate()} value={paidOn} onChange={e=>setPaidOn(e.target.value)}/></label></div>
          <Input ref={fileInput} className="sr-only" tabIndex={-1} aria-label="Arquivo do comprovante" type="file" accept="application/pdf,image/jpeg,image/png" onChange={e=>setFile(e.target.files?.[0]??null)}/>
          <Button variant="outline" className="payout-pix-upload" data-attached={!!file} onClick={()=>fileInput.current?.click()}><span className="payout-pix-upload-icon">{file?<FileCheck size={22}/>:<Upload size={22}/>}</span><span className="min-w-0"><strong>{file?file.name:"Anexar comprovante"}</strong><span>{file?`${(file.size/1024/1024).toFixed(2)} MB · Alterar arquivo`:"PDF, JPG ou PNG · até 10 MB"}</span></span>{file&&<Check size={18} className="shrink-0"/>}</Button>
          <label className="payout-pix-confirmation"><Checkbox checked={confirmed} onCheckedChange={value=>setConfirmed(value===true)}/><span>Confirmo que o pagamento foi realizado ao titular acima.</span></label>
          <Button className="payout-pix-submit" disabled={busy||!confirmed||!file||file.size>10*1024*1024||(parseMoneyText(amount)??0)<=0||(parseMoneyText(amount)??0)>Number(payment.request.amount_cents)||!paidOn} onClick={save}><FileCheck size={18}/>{busy?"Salvando…":"Finalizar e salvar comprovante"}</Button>
        </div>
      </div>}
    </DialogContent></Dialog>
  </div>;
}