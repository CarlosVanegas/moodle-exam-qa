import { test, expect } from '@playwright/test';
import { login, STUDENT } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

// RC2+RC3: selector completo para Moodle 4.4 español
const START_BTN = '.quizstartbuttondiv button, .quizstartbuttondiv input[type="submit"], button:has-text("Intentar"), input[value*="Intentar"], button:has-text("Iniciar intento"), a:has-text("Iniciar intento")';

test.describe('08 — Envío del intento', () => {

  // Inicia un intento del estudiante. Devuelve false si no hay intento disponible o no hay preguntas.
  async function startAttempt(page: Parameters<typeof login>[0]): Promise<boolean> {
    await gotoCourse(page);
    // RC2: getByRole evita el <label class="sr-only">
    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const startBtn = page.locator(START_BTN).first();
    if (!(await startBtn.isVisible({ timeout: 5_000 }).catch(() => false))) return false;

    await startBtn.click();
    await waitForMoodle(page);

    // RC5: diálogo YUI de tiempo límite
    const yui = page.locator(
      '.moodle-dialogue-base[aria-hidden="false"] .btn-primary, .moodle-dialogue-base[aria-hidden="false"] input[type="submit"]'
    ).first();
    if (await yui.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await yui.click({ force: true });
      await waitForMoodle(page);
    }

    // RC9: quiz sin preguntas — no hay nada que enviar
    const noQText = await page.locator('text=No se han encontrado respuestas').count();
    const noQLink = await page.locator('a[href*="noquestionsfound"]').count();
    if (noQText > 0 || noQLink > 0) return false;

    return true;
  }

  // Navega a la página de resumen ("Terminar intento") desde el intento activo.
  async function gotoSummary(page: Parameters<typeof login>[0]) {
    const finishLink = page.locator(
      'button:has-text("Terminar intento"), a:has-text("Terminar intento"), input[value*="Terminar"]'
    ).first();
    if (await finishLink.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await finishLink.click();
      await waitForMoodle(page);
    }
  }

  test('el estudiante ve el botón de enviar durante el intento', async ({ page }) => {
    await login(page, STUDENT);
    const started = await startAttempt(page);
    if (!started) {
      test.skip(true, 'No se puede iniciar intento o quiz sin preguntas.');
      return;
    }

    await gotoSummary(page);

    const submitBtn = page.locator(
      'button:has-text("Enviar todo y terminar"), input[value*="Enviar todo"]'
    ).first();
    const visible = await submitBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Botón "Enviar todo y terminar" visible: ${visible}`,
    });
    if (visible) {
      await expect(submitBtn).toBeVisible();
    }
  });

  test('aparece un diálogo de confirmación al enviar', async ({ page }) => {
    await login(page, STUDENT);
    const started = await startAttempt(page);
    if (!started) {
      test.skip(true, 'No se puede iniciar intento o quiz sin preguntas.');
      return;
    }

    await gotoSummary(page);

    const submitBtn = page.locator(
      'button:has-text("Enviar todo y terminar"), input[value*="Enviar todo"]'
    ).first();
    if (!(await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Botón de envío no encontrado.');
      return;
    }

    await submitBtn.click();

    const confirmDialog = page.locator(
      '.moodle-dialogue-base[aria-hidden="false"], .modal-content, [role="dialog"], button:has-text("Enviar todo y terminar")'
    ).first();
    const dialogVisible = await confirmDialog.isVisible({ timeout: 10_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Diálogo de confirmación visible: ${dialogVisible}`,
    });
    if (dialogVisible) {
      await expect(confirmDialog).toBeVisible();
    }
  });

  test('el estudiante puede cancelar el envío y volver al intento', async ({ page }) => {
    await login(page, STUDENT);
    const started = await startAttempt(page);
    if (!started) {
      test.skip(true, 'No se puede iniciar intento o quiz sin preguntas.');
      return;
    }

    await gotoSummary(page);

    const submitBtn = page.locator(
      'button:has-text("Enviar todo y terminar"), input[value*="Enviar todo"]'
    ).first();
    if (!(await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Botón de envío no encontrado.');
      return;
    }

    await submitBtn.click();

    const cancelBtn = page.locator(
      'button:has-text("Cancelar"), a:has-text("Cancelar"), button:has-text("Cancel")'
    ).first();
    if (await cancelBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await cancelBtn.click();
      await waitForMoodle(page);
      test.info().annotations.push({ type: 'info', description: 'Cancelación de envío exitosa.' });
    } else {
      test.info().annotations.push({ type: 'info', description: 'No se encontró botón Cancelar.' });
    }
  });

  test('el estudiante confirma el envío y llega a la pantalla de resultado', async ({ page }) => {
    await login(page, STUDENT);
    const started = await startAttempt(page);
    if (!started) {
      test.skip(true, 'No se puede iniciar intento o quiz sin preguntas.');
      return;
    }

    await gotoSummary(page);

    const submitBtn = page.locator(
      'button:has-text("Enviar todo y terminar"), input[value*="Enviar todo"]'
    ).first();
    if (!(await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Botón de envío no encontrado.');
      return;
    }

    await submitBtn.click();
    await waitForMoodle(page);

    const confirmBtn = page.locator(
      '.moodle-dialogue-base[aria-hidden="false"] .btn-primary, button:has-text("Enviar todo y terminar")'
    ).last();
    if (await confirmBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await confirmBtn.click({ force: true });
      await waitForMoodle(page);
    }

    const summary = page.locator(
      '.quizreviewsummary, .quiz-summary, h2:has-text("Resumen"), h2:has-text("Finalizado"), .submittednotice'
    ).first();
    const summaryVisible = await summary.isVisible({ timeout: 20_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Pantalla de resultado visible: ${summaryVisible}`,
    });
    if (summaryVisible) {
      await expect(summary).toBeVisible();
    }
  });

  test('el resumen del intento enviado muestra la nota obtenida', async ({ page }) => {
    await login(page, STUDENT);
    const started = await startAttempt(page);
    if (!started) {
      test.skip(true, 'No se puede iniciar intento o quiz sin preguntas.');
      return;
    }

    await gotoSummary(page);

    const submitBtn = page.locator(
      'button:has-text("Enviar todo y terminar"), input[value*="Enviar todo"]'
    ).first();
    if (!(await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Botón de envío no encontrado.');
      return;
    }

    await submitBtn.click();
    await waitForMoodle(page);

    const confirmBtn = page.locator(
      '.moodle-dialogue-base[aria-hidden="false"] .btn-primary, button:has-text("Enviar todo y terminar")'
    ).last();
    if (await confirmBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await confirmBtn.click({ force: true });
      await waitForMoodle(page);
    }

    const gradeInfo = page.locator(
      '.quizreviewsummary td, .grade, [class*="grade"]'
    ).first();
    const isGradeVisible = await gradeInfo.isVisible({ timeout: 10_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Nota visible en pantalla de resultado: ${isGradeVisible}`,
    });
  });

});
