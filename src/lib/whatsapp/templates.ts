/** Templates de mensagem do WhatsApp (seção 23 do plano) — texto configurável, não hardcoded na tela. */

export interface ProposalReadyTemplateInput {
  ownerFirstName: string;
  portalUrl: string | null;
}

export function proposalReadyMessage(input: ProposalReadyTemplateInput): string {
  const firstName = input.ownerFirstName.trim().split(/\s+/)[0] || input.ownerFirstName;
  const lines = [
    `Olá, ${firstName}! Foi um prazer conversar com você.`,
    "",
    "Preparei a proposta e o planejamento inicial da implantação do seu imóvel pela Stayo.",
    "",
  ];
  if (input.portalUrl) {
    lines.push(`🔗 Acompanhar implantação e ver a proposta: ${input.portalUrl}`);
    lines.push("");
  }
  lines.push("Qualquer dúvida, fico à disposição.");
  return lines.join("\n");
}
