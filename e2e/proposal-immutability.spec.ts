import { expect, test } from "@playwright/test";

import { settle } from "./helpers";

/**
 * Fase 18B: uma proposta aceita/versão nunca deve "trocar de versão" por
 * baixo dos pés de quem já tem o link antigo salvo — v2 nunca altera v1,
 * e o link da v1 continua mostrando a v1 para sempre, mesmo depois que a
 * v2 existe (ver docs/OWNER_IMPLEMENTATION_AUDIT.md §4.1). Isso é lógica
 * pura do adapter local (`proposalsStore`/`proposalShareStore`,
 * `src/lib/api/local-store.ts`) — não depende do Supabase estar
 * configurado, então é testável de ponta a ponta aqui, sem bloqueio de
 * credencial externa.
 */
test("link da v1 continua mostrando a v1 mesmo depois de existir uma v2", async ({ page }) => {
  const implementationId = "e2e-impl-immutability";

  await page.goto("/");
  await page.evaluate((implId) => {
    const now = new Date().toISOString();
    window.localStorage.setItem(
      "stayo-admin:proposals",
      JSON.stringify([
        {
          id: "prop-v1",
          implementationId: implId,
          version: 1,
          items: [
            { description: "Setup inicial", quantity: 1, unitValue: 500, discount: 0, total: 500 },
          ],
          total: 500,
          acceptedAt: null,
          acceptedName: null,
          createdAt: now,
        },
        {
          id: "prop-v2",
          implementationId: implId,
          version: 2,
          items: [
            { description: "Setup revisado", quantity: 1, unitValue: 800, discount: 0, total: 800 },
          ],
          total: 800,
          acceptedAt: null,
          acceptedName: null,
          createdAt: now,
        },
      ]),
    );
    window.localStorage.setItem(
      "stayo-admin:proposal-share-links",
      JSON.stringify([
        { proposalId: "prop-v1", implementationId: implId, token: "e2e-token-v1", createdAt: now },
        { proposalId: "prop-v2", implementationId: implId, token: "e2e-token-v2", createdAt: now },
      ]),
    );
  }, implementationId);

  await page.goto("/portal/proposta/e2e-token-v1");
  await page.waitForSelector("text=Proposta comercial");
  await settle(page);

  await expect(page.getByText(/Versão 1/)).toBeVisible();
  await expect(page.locator("text=Setup inicial")).toBeVisible();
  await expect(page.locator("text=Setup revisado")).toHaveCount(0);
  await expect(page.locator("text=Versão 2")).toHaveCount(0);
});

test("link da v2 mostra a v2, isolado da v1", async ({ page }) => {
  const implementationId = "e2e-impl-immutability-2";

  await page.goto("/");
  await page.evaluate((implId) => {
    const now = new Date().toISOString();
    window.localStorage.setItem(
      "stayo-admin:proposals",
      JSON.stringify([
        {
          id: "prop-2-v1",
          implementationId: implId,
          version: 1,
          items: [
            {
              description: "Setup inicial B",
              quantity: 1,
              unitValue: 500,
              discount: 0,
              total: 500,
            },
          ],
          total: 500,
          acceptedAt: null,
          acceptedName: null,
          createdAt: now,
        },
        {
          id: "prop-2-v2",
          implementationId: implId,
          version: 2,
          items: [
            {
              description: "Setup revisado B",
              quantity: 1,
              unitValue: 800,
              discount: 0,
              total: 800,
            },
          ],
          total: 800,
          acceptedAt: null,
          acceptedName: null,
          createdAt: now,
        },
      ]),
    );
    window.localStorage.setItem(
      "stayo-admin:proposal-share-links",
      JSON.stringify([
        {
          proposalId: "prop-2-v1",
          implementationId: implId,
          token: "e2e-token-2-v1",
          createdAt: now,
        },
        {
          proposalId: "prop-2-v2",
          implementationId: implId,
          token: "e2e-token-2-v2",
          createdAt: now,
        },
      ]),
    );
  }, implementationId);

  await page.goto("/portal/proposta/e2e-token-2-v2");
  await page.waitForSelector("text=Proposta comercial");
  await settle(page);

  await expect(page.locator("text=Versão 2")).toBeVisible();
  await expect(page.locator("text=Setup revisado B")).toBeVisible();
  await expect(page.locator("text=Setup inicial B")).toHaveCount(0);
});

test("token inexistente mostra proposta indisponível, nunca vaza qual proposta existe", async ({
  page,
}) => {
  await page.goto("/portal/proposta/token-que-nunca-existiu");
  await page.waitForSelector("text=Esta proposta não está disponível");
  await settle(page);

  await expect(page.getByRole("heading", { name: "Proposta comercial" })).toHaveCount(0);
});
