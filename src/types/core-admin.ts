/**
 * Contratos da área técnica "Stayo Core" (Configurações).
 *
 * São os formatos que o Core deve expor para o Admin operar a integração:
 * saúde, apps consumidores, scopes, webhooks e logs de requisição.
 */

import type { EntityId } from "./core";

export interface CoreHealth {
  status: "ok" | "degraded" | "down";
  version: string;
  checkedAt: string;
  uptimePercent: number | null;
  latencyMs: number | null;
}

export interface CoreApiInfo {
  version: string;
  baseUrl: string | null;
  docsUrl: string | null;
  environment: string | null;
  status: "ok" | "degraded" | "down";
}

/**
 * Cada aplicativo consumidor tem credencial PRÓPRIA.
 * Nunca existe chave mestra compartilhada entre aplicativos.
 */
export interface ConsumerApp {
  id: EntityId;
  name: string;
  description: string | null;
  /** Identificador público da credencial; o segredo nunca trafega. */
  credentialId: string | null;
  credentialCreatedAt: string | null;
  credentialLastRotatedAt: string | null;
  active: boolean;
  scopes: string[];
}

export interface CoreScope {
  name: string;
  description: string;
  sensitive: boolean;
}

export interface CoreWebhook {
  id: EntityId;
  url: string;
  appId: EntityId;
  appName: string | null;
  events: string[];
  active: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  failureCount: number;
}

export interface CoreEvent {
  id: EntityId;
  name: string;
  appName: string | null;
  occurredAt: string;
}

/**
 * Entrada de log de requisição ao Core.
 *
 * REGRA: este log NUNCA deve registrar senha, token, documento ou selfie.
 * Nenhum desses campos existe neste tipo de propósito — o `errorSummary`
 * é texto resumido e já sanitizado na origem.
 */
export interface CoreLogEntry {
  id: EntityId;
  occurredAt: string;
  appName: string | null;
  endpoint: string;
  status: number;
  latencyMs: number | null;
  correlationId: string;
  errorSummary: string | null;
}

export interface CoreOverview {
  health: CoreHealth;
  api: CoreApiInfo;
  appsCount: number;
  recentEvents: CoreEvent[];
  recentErrors: CoreLogEntry[];
}
