/**
 * Futuro adapter HTTP do Stayo Core.
 *
 * Nenhum endpoint é definido aqui até que o contrato oficial da API v1 exista.
 */
import type { CoreClient, CoreApiConfig } from "./core-client";

export class HttpCoreAdapter {
  constructor(private readonly config: CoreApiConfig) {}

  createClient(): CoreClient {
    void this.config;
    throw new Error("HttpCoreAdapter ainda não implementado: contrato HTTP do Stayo Core indisponível");
  }
}
