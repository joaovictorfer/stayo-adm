import { createFileRoute } from "@tanstack/react-router";
import { ChargesPrototype } from "@/components/admin/ChargesPrototype";

export const Route = createFileRoute("/financeiro/cobrancas-prototipo")({
  head: () => ({ meta: [
    { title: "Cobranças — demonstração STAYO Admin" },
    { name: "description", content: "Prévia da central STAYO de cobranças avulsas e por imóvel. Sem pagamentos reais." },
    { property: "og:title", content: "Cobranças — demonstração STAYO Admin" },
    { property: "og:description", content: "Demonstração de cobranças por serviços, com Pix e cartão, sem transações reais." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: ChargesPrototype,
});