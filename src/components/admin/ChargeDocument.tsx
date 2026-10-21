import { useState } from "react";
import { CheckCircle2, CreditCard, LockKeyhole, QrCode, Receipt, RotateCcw } from "lucide-react";
import apartment from "@/assets/charge-demo-apartment.jpg";
import { StayoLogo } from "@/components/brand/StayoLogo";
import { Button } from "@/components/ui/button";
import { chargeTotals, type DemoCharge } from "@/lib/charge-prototype";
import { formatBRL } from "@/lib/money";

export type DocumentState = "normal" | "processing" | "paid" | "declined" | "expired" | "cancelled" | "revoked" | "error" | "loading";
export const documentStates: { value: DocumentState; label: string }[] = [
  { value: "normal", label: "Disponível" }, { value: "loading", label: "Carregando" }, { value: "processing", label: "Processando" }, { value: "paid", label: "Pago" }, { value: "declined", label: "Recusado" }, { value: "expired", label: "Pix expirado" }, { value: "cancelled", label: "Cancelado" }, { value: "revoked", label: "Link revogado" }, { value: "error", label: "Falha temporária" },
];
const date = (value: string) => value ? value.split("-").reverse().join("/") : "—";
export function ChargeDocument({ charge, state = "normal", onReset, persistent = false, coverUrl }: { charge: DemoCharge; state?: DocumentState; onReset?: () => void; persistent?: boolean; coverUrl?: string }) {
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [notice, setNotice] = useState(false);
  const totals = chargeTotals(charge.items);
  const value = (cents: number) => formatBRL(cents / 100);
  const resolved = charge.status === "cancelled" ? "cancelled" : charge.status === "paid" ? "paid" : state;
  if (resolved === "loading") return <div className="charge-skeleton" role="status" aria-label="Carregando cobrança"><div /><div /><div /></div>;
  if (resolved === "revoked" || resolved === "error") return <div className="charge-unavailable"><LockKeyhole size={32} /><h2>{resolved === "revoked" ? "Link indisponível" : "Não foi possível carregar a cobrança"}</h2><p>{resolved === "revoked" ? "Este link expirou ou foi revogado." : "Tente novamente em alguns instantes."}</p>{onReset && <Button variant="outline" onClick={onReset}><RotateCcw />Tentar novamente</Button>}</div>;
  return <article className="charge-document">
    <header className={`charge-cover ${charge.presentedProperty ? "has-photo" : ""}`}>
      {charge.presentedProperty && (!persistent || coverUrl) && <img src={persistent ? coverUrl : apartment} width={1536} height={864} alt={persistent ? "Imóvel" : "Apartamento fictício de demonstração"} className="charge-cover-photo" />}
      <div className="charge-cover-brand"><StayoLogo variant="white" className="w-24" /><span>DEMONSTRATIVO<br /><strong>{charge.code}</strong></span></div>
      <div className="charge-cover-title"><span className="charge-eyebrow">Serviços e reembolsos</span><h1>{charge.title || "Nova cobrança"}</h1><p>{charge.presentedProperty || "Cobrança avulsa"}</p></div>
    </header>
    <div className="charge-document-body">
      <div className="charge-document-meta"><div><span>Emissão</span><strong>{date(charge.issued)}</strong></div><div><span>Competência</span><strong>{charge.competence ? date(charge.competence) : "—"}</strong></div><div><span>Vencimento</span><strong>{date(charge.due)}</strong></div></div>
      <div className="charge-recipient"><span>Destinatário</span><strong>{charge.recipient || "Não informado"}</strong></div>
      <section><div className="charge-section-title"><h2>Serviços cobrados</h2><span>{charge.items.length} {charge.items.length === 1 ? "item" : "itens"}</span></div>
        {charge.items.map((item, index) => <div className="charge-document-item" key={item.id}><span className="charge-item-number">{index + 1}</span><div><strong>{item.description || "Descrição do serviço"}</strong><span>{item.quantity} × {value(item.unitCents)}</span></div><strong>{value(item.quantity * item.unitCents)}</strong></div>)}
        <div className="charge-subtotal"><span>Subtotal</span><strong>{value(totals.subtotal)}</strong></div>
      </section>
      {charge.notes && <section className="charge-observation"><span>Observação</span><p>{charge.notes}</p></section>}
      <section className="charge-payment"><h2>Pagamento</h2>
        {resolved === "paid" ? <div className="charge-payment-status is-success"><CheckCircle2 /><div><strong>Pagamento confirmado · demonstração</strong><p>Nenhum pagamento real foi realizado.</p></div></div> : resolved === "cancelled" ? <div className="charge-payment-status"><LockKeyhole /><strong>Cobrança cancelada · demonstração</strong></div> : <>
          <div className="charge-payment-options"><Button variant="outline" aria-pressed={method === "pix"} className="charge-payment-option" onClick={() => { setMethod("pix"); setNotice(false); }}><QrCode /><span>Pix<strong>{value(totals.pix)}</strong><small>Sem acréscimo</small></span>{method === "pix" && <CheckCircle2 />}</Button><Button variant="outline" aria-pressed={method === "card"} className="charge-payment-option" onClick={() => { setMethod("card"); setNotice(false); }}><CreditCard /><span>Cartão de crédito<strong>{value(totals.card)}</strong><small>Acréscimo de 5%</small></span>{method === "card" && <CheckCircle2 />}</Button></div>
          <div className="charge-payment-total">{method === "card" && <p><span>Acréscimo de 5%</span><strong>{value(totals.surcharge)}</strong></p>}<p><span>Total no {method === "pix" ? "Pix" : "cartão"}</span><strong>{value(method === "pix" ? totals.pix : totals.card)}</strong></p></div>
          {resolved !== "normal" && <div className="charge-payment-status" role="status"><Receipt /><div><strong>{{ processing: "Pagamento em processamento", declined: "Pagamento não aprovado", expired: "Pix expirado" }[resolved as "processing" | "declined" | "expired"]}</strong><p>Estado demonstrativo. Nenhuma transação realizada.</p></div></div>}
          <Button className="w-full" disabled={persistent || resolved === "processing"} onClick={() => setNotice(true)}>{method === "pix" ? <QrCode /> : <CreditCard />}{persistent ? "Pagamento ainda indisponível" : "Conferir pagamento · demonstração"}</Button>
          {(notice || persistent) && <p className="charge-demo-notice" role="status">{persistent ? "O demonstrativo está disponível para consulta. Pagamento aguardando ativação da Pagar.me." : "Pagar.me ainda não conectado. Esta prévia não gera cobrança, QR Code ou pagamento."}</p>}
        </>}
      </section>
      <footer className="charge-document-footer"><LockKeyhole size={14} /><span>{persistent ? "Demonstrativo de serviços · não é nota fiscal" : "Prévia demonstrativa · sem validade fiscal ou link pagável"}</span></footer>
    </div>
  </article>;
}