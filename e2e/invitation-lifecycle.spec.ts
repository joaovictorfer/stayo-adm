import { expect, test } from "@playwright/test";

import { hashTokenInBrowser, settle } from "./helpers";

/**
 * Fase 18: o portal de auto-cadastro precisa recusar corretamente cada
 * estado inválido de convite — não só o caminho feliz. Isto exercita a
 * lógica de status (`ownerOnboardingLinkStatus`, src/types/owner-onboarding.ts)
 * e a página (`portal.implantacao.$token.tsx`) de ponta a ponta contra o
 * adapter local, sem depender de credencial do Supabase — o mesmo motivo
 * de docs/MULTI_DEVICE_VALIDATION.md: a UI destas telas não muda
 * dependendo de qual adapter está por baixo, só o transporte muda.
 */

async function seedLink(
  page: import("@playwright/test").Page,
  overrides: Partial<{
    expiresAt: string;
    usedAt: string | null;
    revokedAt: string | null;
  }>,
  token: string,
): Promise<void> {
  const tokenHash = await hashTokenInBrowser(page, token);
  await page.evaluate(
    ({ tokenHash, overrides }) => {
      const now = new Date().toISOString();
      window.localStorage.setItem(
        "stayo-admin:owner-onboarding-links",
        JSON.stringify([
          {
            id: "e2e-link-1",
            implementationId: "e2e-impl-invite",
            ownerId: null,
            tokenHash,
            createdAt: now,
            createdBy: null,
            expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 86400_000).toISOString(),
            usedAt: overrides.usedAt ?? null,
            revokedAt: overrides.revokedAt ?? null,
            lastAccessAt: null,
          },
        ]),
      );
    },
    { tokenHash, overrides },
  );
}

test("convite inexistente mostra link inválido", async ({ page }) => {
  await page.goto("/portal/implantacao/token-que-nunca-existiu");
  await page.waitForSelector("text=Link inválido");
  await settle(page);
  await expect(page.locator("text=não existe")).toBeVisible();
});

test("convite expirado é recusado com a mensagem certa", async ({ page }) => {
  await page.goto("/");
  await seedLink(
    page,
    { expiresAt: new Date(Date.now() - 86400_000).toISOString() },
    "e2e-expired",
  );
  await page.goto("/portal/implantacao/e2e-expired");
  await page.waitForSelector("text=Link expirado");
  await settle(page);
});

test("convite revogado é recusado com a mensagem certa", async ({ page }) => {
  await page.goto("/");
  await seedLink(page, { revokedAt: new Date().toISOString() }, "e2e-revoked");
  await page.goto("/portal/implantacao/e2e-revoked");
  await page.waitForSelector("text=Link revogado");
  await settle(page);
});

test("convite já usado mostra o cadastro recebido, nunca o formulário de novo", async ({
  page,
}) => {
  await page.goto("/");
  await seedLink(page, { usedAt: new Date().toISOString() }, "e2e-used");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "stayo-admin:owner-onboarding-submissions",
      JSON.stringify([
        {
          implementationId: "e2e-impl-invite",
          fullName: "Proprietário Já Cadastrado",
          document: null,
          email: "ja-cadastrado@example.com",
          phone: "11988887777",
          pixKey: null,
          submittedAt: new Date().toISOString(),
        },
      ]),
    );
  });
  await page.goto("/portal/implantacao/e2e-used");
  await page.waitForSelector("text=Cadastro recebido");
  await settle(page);

  await expect(page.locator("text=Proprietário Já Cadastrado")).toBeVisible();
  await expect(page.locator("text=Complete seu cadastro")).toHaveCount(0);
});

test("convite válido mostra o formulário de auto-cadastro", async ({ page }) => {
  await page.goto("/");
  await seedLink(page, {}, "e2e-valid");
  await page.goto("/portal/implantacao/e2e-valid");
  await page.waitForSelector("text=Complete seu cadastro");
  await settle(page);

  await expect(page.locator("text=Identificação")).toBeVisible();
});
