import { createFileRoute } from "@tanstack/react-router";
import { ChargesWorkspace } from "@/components/admin/ChargesWorkspace";
export const Route = createFileRoute("/financeiro/cobrancas/")({ head: () => ({meta:[{title:"Cobranças — STAYO Admin"},{name:"description",content:"Central de cobranças avulsas e vinculadas a imóveis STAYO."},{property:"og:title",content:"Cobranças — STAYO Admin"},{property:"og:description",content:"Demonstrativos e histórico de serviços STAYO."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component: ChargesWorkspace});
