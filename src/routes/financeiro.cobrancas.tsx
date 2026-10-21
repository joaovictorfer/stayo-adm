import { createFileRoute, Outlet } from "@tanstack/react-router";
export const Route = createFileRoute("/financeiro/cobrancas")({component: () => <Outlet/>});
