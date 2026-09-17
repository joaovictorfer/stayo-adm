import { Link } from "@tanstack/react-router";
import type { ComponentType, CSSProperties, ReactNode } from "react";

/** `to` vem de dados de configuração/relacionamento, então usamos o Link com tipagem solta. */
const DynamicLink = Link as unknown as ComponentType<{
  to: string;
  params: Record<string, string>;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}>;

/** Referência clicável entre módulos (ex: vistoria → imóvel), em vez de mostrar só o ID cru. */
export function LinkedField({ to, id, label }: { to: string; id: string; label?: string | null }) {
  return (
    <DynamicLink
      to={to}
      params={{ id }}
      className="underline"
      style={{ color: "var(--stayo-forest)" }}
    >
      {label ?? id}
    </DynamicLink>
  );
}
