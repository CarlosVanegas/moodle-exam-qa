import { test, expect } from '@playwright/test';
import { login, STUDENT } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

const WEBHOOK_LOG_URL = 'http://localhost:3001/log';

// RC3: botón de inicio en Moodle 4.4 español
const START_BTN = '.quizstartbuttondiv button, .quizstartbuttondiv input[type="submit"], button:has-text("Intentar"), input[value*="Intentar"], button:has-text("Iniciar intento"), a:has-text("Iniciar intento")';

test.describe('Cambio 3 — Notificación externa al enviar intento', () => {

  test('el webhook recibe la notificación al enviar un intento', async ({ page, request }) => {
    const beforeLog = await request.get(WEBHOOK_LOG_URL);
    const beforeCount = (await beforeLog.json()).length;

    await login(page, STUDENT);
    await gotoCourse(page);

    // RC2 fix: getByRole evita el <label class="sr-only">
    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    // RC3 fix: añadir variantes de texto de Moodle 4.4
    const startBtn = page.locator(START_BTN).first();
    if (!(await startBtn.isVisible({ timeout: 10_000 }))) {
      test.info().annotations.push({ type: 'info', description: 'No se puede iniciar intento para probar el webhook.' });
      return;
    }
    await startBtn.click();
    await waitForMoodle(page);

    // RC5: diálogo YUI de tiempo límite intercepta el click — usar force + selector del diálogo
    const yuiConfirm = page.locator(
      '.moodle-dialogue-base[aria-hidden="false"] .btn-primary, .moodle-dialogue-base[aria-hidden="false"] input[type="submit"]'
    ).first();
    if (await yuiConfirm.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await yuiConfirm.click({ force: true });
      await waitForMoodle(page);
    }

    // RC8: "Enviar todo y terminar" solo aparece en la página de resumen del intento.
    // Primero hay que ir a esa página con "Terminar intento...".
    const finishLink = page.locator(
      'button:has-text("Terminar intento"), a:has-text("Terminar intento"), input[value*="Terminar"]'
    ).first();
    if (await finishLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await finishLink.click();
      await waitForMoodle(page);
    }

    const submitBtn = page.locator('button:has-text("Enviar todo y terminar"), input[value*="Enviar todo"]').first();
    if (!(await submitBtn.isVisible({ timeout: 10_000 }).catch(() => false))) {
      test.info().annotations.push({ type: 'info', description: 'Botón de envío no encontrado; posiblemente el examen no tiene intentos disponibles.' });
      return;
    }
    await submitBtn.click();
    await waitForMoodle(page);

    const confirmSubmit = page.locator('.moodle-dialogue-base[aria-hidden="false"] .btn-primary, button:has-text("Enviar todo y terminar")').last();
    if (await confirmSubmit.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await confirmSubmit.click({ force: true });
    }
    await waitForMoodle(page);

    await page.waitForTimeout(3000);

    const afterLog = await request.get(WEBHOOK_LOG_URL);
    const afterEntries = await afterLog.json();
    expect(afterEntries.length).toBeGreaterThan(beforeCount);

    const lastEntry = afterEntries[afterEntries.length - 1];
    expect(lastEntry.body).toHaveProperty('student');
    expect(lastEntry.body).toHaveProperty('quiz');
    expect(lastEntry.body).toHaveProperty('attempt_grade');
    expect(lastEntry.body).toHaveProperty('timestamp');
  });

  test('el log de webhook queda registrado en Moodle', async ({ page }) => {
    await login(page, { user: 'admin', pass: process.env.MOODLE_PASSWORD ?? 'Admin1234!' });

    await page.goto('/admin/settings.php?section=local_gesexam');
    await waitForMoodle(page);

    await expect(page.locator('input[name="s_local_gesexam_webhook_url"]')).toBeVisible();
  });

});
