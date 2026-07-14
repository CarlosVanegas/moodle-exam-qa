import { test, expect } from '@playwright/test';
import { login, TEACHER } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

test.describe('01 — Crear y configurar examen', () => {

  test('profesor puede crear un examen con timer, intentos y método de calificación', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    // Activar edición del curso (Moodle 4.x usa un toggle, no un botón)
    await page.click('.editmode-switch-form label, button:has-text("Activar edición"), a:has-text("Activar edición")');
    await waitForMoodle(page);

    // Agregar actividad → Examen
    await page.click('text=Añadir una actividad o un recurso');
    await waitForMoodle(page);
    // Moodle 4.4: chooser option cards have data-region="chooser-option-container"
    await page.locator('[data-region="chooser-option-container"][data-internal="quiz"]').first().click();
    await waitForMoodle(page);

    // Nombre del examen
    const examName = `Examen QA ${Date.now()}`;
    await page.fill('#id_name', examName);

    // Temporalización — collapsed by default, use the Bootstrap collapse toggle
    await page.click('a[href="#id_timingcontainer"]');
    await page.waitForTimeout(300);

    // Límite de tiempo: habilitar y poner 10 minutos
    await page.check('#id_timelimit_enabled');
    await page.fill('input[name="timelimit[number]"]', '10');
    await page.selectOption('select[name="timelimit[timeunit]"]', '60'); // 60 = minutos

    // Periodo de gracia: seleccionar "graceperiod" en el dropdown
    await page.selectOption('select#id_overduehandling', 'graceperiod');

    // Calificación — collapsed, use the Bootstrap collapse toggle
    await page.click('a[href="#id_modstandardgradecontainer"]');
    await page.waitForTimeout(300);
    await page.selectOption('#id_attempts', '0'); // 0 = Sin límite

    // Guardar
    await page.click('#id_submitbutton2');
    await waitForMoodle(page);

    await expect(page.locator(`text=${examName}`).first()).toBeVisible();
  });

});
