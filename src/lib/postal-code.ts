export type PostalAddress = { street: string; district: string; city: string; state: string };

export function formatPostalCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export async function lookupPostalCode(value: string, signal?: AbortSignal): Promise<PostalAddress> {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) throw new Error("Digite um CEP com 8 números.");
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal, credentials: "omit" });
  if (!response.ok) throw new Error("Busca indisponível. Tente novamente ou preencha o endereço manualmente.");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("localidade" in data) || !("uf" in data) || ("erro" in data && data.erro)) {
    throw new Error("CEP não encontrado. Confira o número ou preencha o endereço manualmente.");
  }
  const text = (key: string) => key in data && typeof (data as Record<string, unknown>)[key] === "string" ? String((data as Record<string, unknown>)[key]) : "";
  return { street: text("logradouro"), district: text("bairro"), city: text("localidade"), state: text("uf") };
}

/** Generic city CEPs must not erase an existing street or district. */
export function postalAddressPatch(address: PostalAddress): Partial<PostalAddress> {
  return Object.fromEntries(Object.entries(address).filter(([, value]) => value.trim()));
}