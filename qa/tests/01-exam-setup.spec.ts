import { test, expect } from '@playwright/test';
import { login, TEACHER } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

test.describe('01 — Crear y configurar examen', () => {

  test('profesor puede crear un examen con timer, intentos y método de calificación', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    // Activar edición del curso
    await page.click('button:has-text("Activar edición"), a:has-text("Activar edición")');
    await waitForMoodle(page);

    // Agregar actividad → Examen
    await page.click('text=Añadir una actividad o un recurso');
    await page.click('text=Cuestionario');
    await waitForMoodle(page);

    // Nombre del examen
    const examName = `Examen QA ${Date.now()}`;
    await page.fill('#id_name', examName);

    // Timing: límite de tiempo 10 minutos
    await page.click('text=Sincronización');
    await page.check('#id_timelimit_enabled');
    await page.fill('input[name="timelimit[number]"]', '10');
    await page.selectOption('select[name="timelimit[timeunit]"]', '60'); // minutos

    // Gracia 2 minutos
    await page.check('#id_overduehandling_graceperiod');
    await page.fill('input[name="graceperiod[number]"]', '2');

    // Intentos permitidos: ilimitados
    await page.click('text=Calificación');
    await page.selectOption('#id_attempts', '0');

    // Guardar
    await page.click('#id_submitbutton2');
    await waitForMoodle(page);

    await expect(page.locator(`text=${examName}`).first()).toBeVisible();
  });

});
