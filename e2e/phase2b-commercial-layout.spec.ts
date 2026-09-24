import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
}

for (const viewport of viewports) {
  test(`Fase 2B mantém listagem e detalhe responsivos em ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/implantacao");

    await expect(page.getByRole("heading", { name: "Implantações" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova oportunidade" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `test-results/phase2b-${viewport.name}-list.png`, fullPage: true });

    const firstRow = page.locator("a.admin-data-row").first();
    if ((await firstRow.count()) === 0) return;
    const href = await firstRow.getAttribute("href");
    expect(href).toMatch(/^\/implantacao\//);
    await page.goto(href!);

    await expect(
      page.getByText(/Reunião e próxima ação|Agenda comercial indisponível|Acesso não autorizado/).first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `test-results/phase2b-${viewport.name}-detail.png`, fullPage: true });
  });
}
