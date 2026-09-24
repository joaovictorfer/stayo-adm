import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
}

for (const viewport of viewports) {
  test(`portal público inválido fica seguro em ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/portal/implantacao/phase2a-token-inexistente");
    await expect(page.getByRole("heading", { name: "Este acesso não está disponível" })).toBeVisible();
    await expect(page.getByText("Peça um novo acesso à equipe STAYO")).toBeVisible();
    await expect(page.getByText(/draft_title|draft_body/i)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test(`proposta pública inexistente mantém fallback em ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/portal/proposta/phase2a-token-inexistente");
    await expect(page.getByRole("heading", { name: "Esta proposta não está disponível" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test(`admin de implantações renderiza sem regressão em ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/implantacao");
    await expect(page.getByRole("heading", { name: "Implantações" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova oportunidade" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
