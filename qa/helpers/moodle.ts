import { Page, expect } from '@playwright/test';

export const COURSE_SHORTNAME = 'QA-GES-001';

/** Navega al curso por shortname */
export async function gotoCourse(page: Page): Promise<void> {
  await page.goto(`/course/search.php?search=${COURSE_SHORTNAME}`);
  await page.waitForLoadState('networkidle');
  // Click the first course result link (course full name, not shortname)
  await page.locator('.coursebox a, [data-region="course-content"] a').first().click();
  await page.waitForLoadState('networkidle');
}

/** Espera a que desaparezca el spinner de Moodle */
export async function waitForMoodle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/** Hace clic en un elemento y espera que la página cargue */
export async function clickAndWait(page: Page, selector: string): Promise<void> {
  await page.click(selector);
  await waitForMoodle(page);
}

/** Verifica que un texto visible está en la página */
export async function assertVisible(page: Page, text: string): Promise<void> {
  await expect(page.locator(`text=${text}`).first()).toBeVisible();
}
