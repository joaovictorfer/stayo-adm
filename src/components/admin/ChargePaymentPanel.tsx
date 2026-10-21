import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, CreditCard, ExternalLink, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkChargePayment, startChargePayment, type PaymentView } from "@/lib/charge-payments.functions";
import { chargeTotals, type DemoCharge } from "@/lib/charge-prototype";
import { formatBRL } from "@/lib/money";

export function ChargePaymentPanel({ token, charge, onPaid }: { token: string; charge: DemoCharge; onPaid: () => void }) {
  const start = useServerFn(startChargePayment);
  const check = useServerFn(checkChargePayment);
  const totals = chargeTotals(charge.items);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [payer, setPayer] = useState({ name: charge.recipient || "", document: "", phone: "", email: "" });
  const [payment, setPayment] = useState<PaymentView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const money = (c: number) => formatBRL(c / 100);

  useEffect(() => { check({ data: { token } }).then(r => { if (r.paid) onPaid(); else if (r.payment) { setPayment(r.payment); setMethod(r.payment.method); } }).catch(() => {}); }, [token]);
  useEffect(() => {
    if (!payment) return;
    const id = setInterval(() => check({ data: { token } }).then(r => { if (r.paid) onPaid(); }).catch(() => {}), 6000);
    return () => clearInterval(id);
  }, [payment, token]);

  async function submit() {
    setBusy(true); setError("");
    try {
      const p = await start({ data: { token, method, payer } });
      setPayment(p);
      if (p?.method === "card" && p.checkoutUrl) window.location.href = p.checkoutUrl;
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível iniciar o pagamento."); }
    finally { setBusy(false); }
  }

  if (payment?.method === "pix" && payment.qrCode) return <div className="space-y-4 text-center">
    <p className="text-sm text-muted-foreground">Pague {money(payment.amountCents)} pelo Pix. A confirmação aparece aqui automaticamente.</p>
    {payment.qrCodeUrl && <img src={payment.qrCodeUrl} alt="QR Code Pix" width={220} height={220} className="mx-auto rounded-lg border bg-card p-2" />}
    <Button variant="outline" className="w-full" onClick={() => { navigator.clipboard.writeText(payment.qrCode!); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? <Check /> : <Copy />}{copied ? "Código copiado" : "Copiar Pix copia e cola"}</Button>
    <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Aguardando pagamento…</p>
    <Button variant="ghost" size="sm" onClick={() => setPayment(null)}>Trocar forma de pagamento</Button>
  </div>;

  return <div className="space-y-4">
    <div className="charge-payment-options">
      <Button variant="outline" aria-pressed={method === "pix"} className="charge-payment-option" onClick={() => setMethod("pix")}><QrCode /><span>Pix<strong>{money(totals.pix)}</strong><small>Sem acréscimo</small></span>{method === "pix" && <Check />}</Button>
      <Button variant="outline" aria-pressed={method === "card"} className="charge-payment-option" onClick={() => setMethod("card")}><CreditCard /><span>Cartão de crédito<strong>{money(totals.card)}</strong><small>Acréscimo de 5%</small></span>{method === "card" && <Check />}</Button>
    </div>
    <div className="charge-payment-total">{method === "card" && <p><span>Acréscimo de 5%</span><strong>{money(totals.surcharge)}</strong></p>}<p><span>Total no {method === "pix" ? "Pix" : "cartão"}</span><strong>{money(method === "pix" ? totals.pix : totals.card)}</strong></p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label htmlFor="pay-name">Nome completo</Label><Input id="pay-name" value={payer.name} onChange={e => setPayer({ ...payer, name: e.target.value })} autoComplete="name" /></div>
      <div><Label htmlFor="pay-doc">CPF ou CNPJ</Label><Input id="pay-doc" inputMode="numeric" value={payer.document} onChange={e => setPayer({ ...payer, document: e.target.value })} /></div>
      <div><Label htmlFor="pay-phone">Celular com DDD</Label><Input id="pay-phone" inputMode="tel" value={payer.phone} onChange={e => setPayer({ ...payer, phone: e.target.value })} autoComplete="tel" /></div>
      <div className="sm:col-span-2"><Label htmlFor="pay-email">E-mail</Label><Input id="pay-email" type="email" value={payer.email} onChange={e => setPayer({ ...payer, email: e.target.value })} autoComplete="email" /></div>
    </div>
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    <Button className="w-full" disabled={busy} onClick={submit}>{busy ? <Loader2 className="animate-spin" /> : method === "pix" ? <QrCode /> : <ExternalLink />}{method === "pix" ? "Gerar QR Code Pix" : "Pagar com cartão"}</Button>
    <p className="text-xs text-center text-muted-foreground">Pagamento processado com segurança pela Pagar.me.</p>
  </div>;
}
