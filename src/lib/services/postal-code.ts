/**
 * Serviço de busca de endereço por CEP — isolado de propósito.
 *
 * O provedor é uma decisão de configuração, não de tela: nenhuma página
 * conhece a URL nem o formato da resposta. Se a busca falhar (CEP
 * inexistente, provedor fora do ar, sem rede), o chamador simplesmente
 * continua com o preenchimento manual — nunca bloqueia o cadastro.
 */

export interface PostalCodeAddress {
  postalCode: string;
  street: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
}

export interface PostalCodeService {
  /** Retorna `null` quando o CEP não é encontrado; lança só em falha de rede. */
  lookup(postalCode: string): Promise<PostalCodeAddress | null>;
}

export function normalizePostalCode(input: string): string {
  return input.replace(/\D/g, "");
}

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

function createViaCepService(): PostalCodeService {
  return {
    async lookup(postalCode) {
      const digits = normalizePostalCode(postalCode);
      if (digits.length !== 8) return null;
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!response.ok) throw new Error("Falha ao consultar o CEP");
      const data = (await response.json()) as ViaCepResponse;
      if (data.erro) return null;
      return {
        postalCode: digits,
        street: data.logradouro || null,
        district: data.bairro || null,
        city: data.localidade || null,
        state: data.uf || null,
      };
    },
  };
}

/** Ponto único de decisão de provedor — nenhuma tela checa env var. */
export function createDefaultPostalCodeService(): PostalCodeService {
  return createViaCepService();
}

export const postalCodeService = createDefaultPostalCodeService();
