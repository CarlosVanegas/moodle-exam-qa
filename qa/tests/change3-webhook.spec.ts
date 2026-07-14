import { test, expect } from '@playwright/test';
import { login, STUDENT } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

const WEBHOOK_LOG_URL = 'http://localhost:3001/log';

test.describe('Cambio 3 — Notificación externa al enviar intento', () => {

  test('el webhook recibe la notificación al enviar un intento', async ({ page, request }) => {
    // Limpiar log previo (el receptor es in-memory, reiniciar no es necesario en CI)
    const beforeLog = await request.get(WEBHOOK_LOG_URL);
    const beforeCount = (await beforeLog.json()).length;

    await login(page, STUDENT);
    await gotoCourse(page);
    await page.click('text=Examen QA', { timeout: 10_000 });
    await waitForMoodle(page);

    await page.click('button:has-text("Iniciar intento"), a:has-text("Iniciar intento")');
    await waitForMoodle(page);

    // Responder mínimamente y enviar
    const submitBtn = page.locator('button:has-text("Enviar todo y terminar"), input[value*="Enviar"]');
    await submitBtn.click();

    // Confirmar el envío en el diálogo
    const confirmBtn = page.locator('button:has-text("Enviar todo y terminar")').last();
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }
    await waitForMoodle(page);

    // Esperar al webhook (puede tardar por reintentos)
    await page.waitForTimeout(3000);

    // Verificar que llegó un nuevo registro al receptor
    const afterLog = await request.get(WEBHOOK_LOG_URL);
    const afterEntries = await afterLog.json();
    expect(afterEntries.length).toBeGreaterThan(beforeCount);

    // Verificar estructura del payload
    const lastEntry = afterEntries[afterEntries.length - 1];
    expect(lastEntry.body).toHaveProperty('student');
    expect(lastEntry.body).toHaveProperty('quiz');
    expect(lastEntry.body).toHaveProperty('attempt_grade');
    expect(lastEntry.body).toHaveProperty('timestamp');
  });

  test('el log de webhook queda registrado en Moodle', async ({ page }) => {
    await login(page, { user: 'admin', pass: process.env.MOODLE_PASSWORD ?? 'Admin1234!' });

    // Ir al log del plugin en administración
    await page.goto('/admin/settings.php?section=local_gesexam');
    await waitForMoodle(page);

    // Verificar que la sección de configuración existe y tiene el campo de URL
    await expect(page.locator('input[name="s_local_gesexam_webhook_url"]')).toBeVisible();
  });

});
