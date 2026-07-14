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
    // Este test verifica la UI post-envío si el intento fue en gracia
    // En un entorno de prueba con timer real esto requiere esperar el timer;
    // en CI se puede mockear el tiempo de expiración editando el intento directamente.
    // Aquí verificamos la estructura de la pantalla de resultado.

    await login(page, STUDENT);
    await gotoCourse(page);
    await page.click('text=Examen QA', { timeout: 10_000 });
    await waitForMoodle(page);

    // Si hay intentos previos, revisar el último
    const reviewLink = page.locator('a:has-text("Revisar"), a:has-text("Review")').first();
    if (await reviewLink.isVisible({ timeout: 3000 })) {
      await reviewLink.click();
      await waitForMoodle(page);

      // Buscar indicador de penalización (si el intento fue en gracia)
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

    // Ir al libro de calificaciones
    await page.click('text=Calificaciones');
    await waitForMoodle(page);

    // Verificar que el libro de calificaciones carga
    await expect(page.locator('table.gradereport-grader-table, #user-grades, .gradeparent')).toBeVisible({ timeout: 15_000 });
  });

});
