/**
 * MODELO de itens padrão de implantação. Ao usar, o sistema cria uma cópia
 * editável dentro do rascunho daquela implantação: mudar este modelo depois
 * não altera rascunhos nem versões publicadas, e editar a cópia não muda o modelo.
 * Os subitens descrevem o escopo; não são cobranças extras.
 */
export interface ProposalItemTemplate {
  key: string;
  description: string;
  unitValue: number;
  details: string;
  scope: string[];
}

export const PROPOSAL_ITEM_TEMPLATES: ProposalItemTemplate[] = [
  {
    key: "implantacao",
    description: "Implantação",
    unitValue: 500,
    details: "Preparação do imóvel para começar a receber hóspedes.",
    scope: [
      "Assessoria inicial",
      "Fotos",
      "Instalação de sensores",
      "Comunicação visual do imóvel",
      "Criação de anúncio",
      "Contrato",
    ],
  },
  { key: "limpeza-pos-obra", description: "Limpeza pós-obra", unitValue: 500, details: "", scope: [] },
  {
    key: "acompanhamento-fornecedores",
    description: "Acompanhamento de fornecedores",
    unitValue: 1000,
    details: "",
    scope: [],
  },
  { key: "limpeza-comercial", description: "Limpeza comercial", unitValue: 250, details: "", scope: [] },
  { key: "lavagem-enxoval", description: "Lavagem de enxoval", unitValue: 200, details: "", scope: [] },
];
