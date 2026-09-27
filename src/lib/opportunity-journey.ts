import { normalizePhone } from "./owner-form-validation";

/** Jornada guiada da nova oportunidade: 5 macroetapas. */
export const JOURNEY_STEPS = [
  { id: "contato", label: "Contato" },
  { id: "imovel", label: "Imóvel" },
  { id: "proposta", label: "Proposta" },
  { id: "implantacao", label: "Implantação" },
  { id: "revisao", label: "Revisão" },
] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number]["id"];

export const PROPOSAL_BLOCKS = ["commercial", "preparation", "contract"] as const;
export type ProposalBlock = (typeof PROPOSAL_BLOCKS)[number];

export function proposalNumberChoice(value: unknown, presets: readonly number[]): string {
  if (value === null || value === undefined || value === "") return "tbd";
  return presets.includes(Number(value)) ? String(value) : "outro";
}

/** Etapas do formulário antigo (8 etapas) mapeadas para a jornada. */
const LEGACY: Record<string, JourneyStep> = {
  proprietario: "contato",
  imovel: "imovel",
  enxoval: "implantacao",
  inventario: "implantacao",
  itens: "implantacao",
  faltantes: "implantacao",
  observacoes: "implantacao",
  condicoes: "proposta",
  revisao: "revisao",
};

export function toJourneyStep(value: unknown): JourneyStep | undefined {
  if (typeof value !== "string") return undefined;
  if (JOURNEY_STEPS.some((s) => s.id === value)) return value as JourneyStep;
  return LEGACY[value];
}

export interface ContactInput {
  title: string;
  name: string;
  phone: string;
}

export type ContactErrors = Partial<Record<keyof ContactInput, string>>;

/** Mínimo comercial para criar a oportunidade (espelha admin_create_opportunity). */
export function validateContact(input: ContactInput): ContactErrors {
  const errors: ContactErrors = {};
  const title = input.title.trim().replace(/\s+/g, " ");
  const name = input.name.trim().replace(/\s+/g, " ");
  if (title.length < 3) errors.title = "Informe um título com pelo menos 3 letras.";
  else if (title.length > 140) errors.title = "Título muito longo.";
  if (name.length < 3) errors.name = "Informe o nome do proprietário.";
  else if (name.length > 120) errors.name = "Nome muito longo.";
  if (!/^55\d{10,11}$/.test(normalizePhone(input.phone)))
    errors.phone = "Informe um telefone com DDD.";
  return errors;
}

export function isContactValid(input: ContactInput): boolean {
  return Object.keys(validateContact(input)).length === 0;
}

export interface ReviewLine {
  label: string;
  value: string | null;
}

/** Resumo da revisão: preenchidos com ✓ e contagem do que falta. */
export function summarize(lines: ReviewLine[]): { filled: ReviewLine[]; missing: number } {
  const filled = lines.filter((l) => (l.value ?? "").toString().trim() !== "");
  return { filled, missing: lines.length - filled.length };
}

type ReviewPropertyValues = {
  condominium_name: string;
  tower: string;
  unit: string;
  address: string;
  city: string;
  property_type: string;
  bedrooms: string;
  capacity: string;
};

export function reviewPropertySummary(values: ReviewPropertyValues): {
  identification: string;
  missing: number;
} {
  const condominium = [values.condominium_name, values.tower, values.unit]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" · ");
  const address = [values.address, values.city]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" · ");
  const identification = condominium || address || values.property_type.trim() || "Sem identificação";
  const checked = [
    values.condominium_name || values.address,
    values.unit,
    values.city,
    values.property_type,
    values.bedrooms,
    values.capacity,
  ];
  return {
    identification,
    missing: checked.filter((value) => !value.trim()).length,
  };
}
