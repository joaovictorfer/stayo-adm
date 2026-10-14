/**
 * Campo monetário brasileiro com digitação natural, da esquerda para a direita:
 * "250" → R$ 250,00; "250,5" → R$ 250,50. Centavos só com vírgula (ou ponto final
 * com até 2 casas). Formata ao sair do campo; guarda número com duas casas.
 */
export function parseBRLInput(text: string): number {
  let t = text.replace(/[^\d,.]/g, "");
  if (!t) return 0;
  if (t.includes(",")) {
    t = t.replace(/\./g, "");
    const [int, ...rest] = t.split(",");
    t = `${int}.${rest.join("").slice(0, 2)}`;
  } else {
    const parts = t.split(".");
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length <= 2) {
      t = `${parts.slice(0, -1).join("")}.${last}`;
    } else {
      t = parts.join("");
    }
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

