import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChargeDocument, documentStates, type DocumentState } from "@/components/admin/ChargeDocument";
import { makeDemoCharges } from "@/lib/charge-prototype";
export const Route = createFileRoute("/portal/cobranca-prototipo")({
  head: () => ({ meta: [
    { title: "Demonstrativo de cobrança — prévia STAYO" },
    { name: "description", content: "Página demonstrativa STAYO de serviços e pagamento. Dados fictícios, sem cobrança real." },
    { property: "og:title", content: "Demonstrativo de cobrança — prévia STAYO" },
    { property: "og:description", content: "Prévia demonstrativa de pagamento de serviços STAYO, sem validade fiscal." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" },
  ] }), component: Preview,
});
function Preview() {
  const [state, setState] = useState<DocumentState>("normal");
  const charge = makeDemoCharges()[0];
  if (!charge) return null;
  return <main className="charge-public charge-workspace"><div className="charge-public-demo"><strong>Demonstração · sem pagamentos reais</strong><label>Estado da página<select aria-label="Estado da página" value={state} onChange={e => setState(e.target.value as DocumentState)}>{documentStates.map(s => <option value={s.value} key={s.value}>{s.label}</option>)}</select></label></div><ChargeDocument charge={charge} state={state} onReset={() => setState("normal")} /></main>;
}