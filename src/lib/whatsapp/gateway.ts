/**
 * Gateway de WhatsApp (Fase 9 do plano de evolução).
 *
 * NUNCA enviar mensagem real automaticamente — nem em testes, nem em
 * produção enquanto não houver provider configurado e autorizado. O mock
 * é o padrão hoje; quando um provider real existir (Meta Cloud API, Twilio
 * etc.), ele implementa a mesma interface e `createDefaultWhatsappGateway()`
 * passa a escolhê-lo — nenhuma tela muda.
 */

export interface WhatsappSendInput {
  to: string;
  body: string;
}

export interface WhatsappSendResult {
  status: "sent" | "failed";
  providerMessageId: string | null;
  error: string | null;
}

export interface WhatsappGateway {
  send(input: WhatsappSendInput): Promise<WhatsappSendResult>;
}

/**
 * Nunca contata um servidor. Deixa a mensagem pronta no outbox como
 * "queued" — o envio de verdade é manual (link wa.me) até existir provider.
 */
export function createMockWhatsappGateway(): WhatsappGateway {
  return {
    send: async () => ({
      status: "failed",
      providerMessageId: null,
      error: "Nenhum provider de WhatsApp configurado — envio manual necessário.",
    }),
  };
}

export function createDefaultWhatsappGateway(): WhatsappGateway {
  // Nenhum provider real integrado ainda — ver docs/WHATSAPP_OUTBOX.md.
  return createMockWhatsappGateway();
}

/**
 * Link wa.me — abre o WhatsApp (app ou web) com o texto já preenchido.
 * Isto é uma funcionalidade padrão e pública do WhatsApp, não uma chamada
 * de API: nada é enviado até a pessoa apertar "Enviar" ela mesma.
 */
export function buildWhatsappDeepLink(phone: string, body: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(body)}`;
}
