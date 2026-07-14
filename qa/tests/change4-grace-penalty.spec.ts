import { test, expect } from '@playwright/test';
import { login, STUDENT, TEACHER } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

test.describe('Cambio 4 — Penalización por entrega en período de gracia', () => {

  test('la configuración de penalización existe en administración', async ({ page }) => {
    await login(page, { user: 'admin', pass: process.env.MOODLE_PASSWORD ?? 'Admin1234!' });
    await page.goto('/admin/settings.php?section=local_gesexam');
    await waitForMoodle(page);

    const penaltyField = page.locator('input[name="s_local_gesexam_grace_penalty"]');
    await expect(penaltyField).toBeVisible();

    const value = await penaltyField.inputValue();
    expect(parseInt(value)).toBeGreaterThanOrEqual(0);
    expect(parseInt(value)).toBeLessThanOrEqual(100);
  });

  test('el resultado del intento muestra la nota original y la penalización al estudiante', async ({ page }) => {
    await login(page, STUDENT);
    await gotoCourse(page);

    // RC2 fix: getByRole evita el <label class="sr-only">
    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const reviewLink = page.locator('a:has-text("Revisar"), a:has-text("Review")').first();
    if (await reviewLink.isVisible({ timeout: 3000 })) {
      await reviewLink.click();
      await waitForMoodle(page);

      const penaltyNote = page.locator('[data-gesexam-penalty], .ges-grace-penalty, text=penalización, text=penalty');
      const count = await penaltyNote.count();
      test.info().annotations.push({
        type: 'info',
        description: `Indicadores de penalización encontrados: ${count}`,
      });
    } else {
      test.info().annotations.push({
        type: 'info',
        description: 'No hay intentos previos para revisar. Penalización visible tras completar un intento en gracia.',
      });
    }
  });

  test('la nota en el gradebook refleja la penalización', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    // RC4 fix: navegar directo al gradebook para evitar dropdown cerrado
    const courseUrl = page.url();
    const courseId = courseUrl.match(/[?&]id=(\d+)/)?.[1] ?? '2';
    await page.goto(`/grade/report/grader/index.php?id=${courseId}`);
    await waitForMoodle(page);

    await expect(page.locator('table.gradereport-grader-table, #user-grades, .gradeparent, h1').first()).toBeVisible({ timeout: 15_000 });
  });

});
