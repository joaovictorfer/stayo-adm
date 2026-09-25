import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
}

for (const viewport of viewports) {
  test(`Fase 2C mantém a aba Proposta responsiva em ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/implantacao", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Implantações" })).toBeVisible();
    const firstRow = page.locator("a.admin-data-row").first();
    if ((await firstRow.count()) === 0) return;

    const href = await firstRow.getAttribute("href");
    expect(href).toMatch(/^\/implantacao\//);
    await page.goto(href!, { waitUntil: "networkidle" });

    const proposalTab = page.getByRole("button", { name: "Proposta", exact: true });
    await expect(proposalTab).toBeVisible();
    await proposalTab.click();

    // O Playwright local desliga deliberadamente a conexão real do Supabase.
    // A Fase 2C deve mostrar erro/desconectado explicitamente, nunca um vazio falso.
    await expect(
      page.getByText(/Propostas desconectadas|não foi possível carregar as propostas/i).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: `test-results/phase2c-${viewport.name}-proposal.png`,
      fullPage: true,
    });
  });
}
