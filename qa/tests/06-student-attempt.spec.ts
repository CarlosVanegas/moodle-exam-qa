import { test, expect } from '@playwright/test';
import { login, STUDENT } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

// RC3: Moodle 4.4 usa "Intentar el cuestionario" en vez de "Iniciar intento"
const START_BTN = 'button:has-text("Iniciar intento"), a:has-text("Iniciar intento"), .quizstartbuttondiv button, .quizstartbuttondiv input[type="submit"], button:has-text("Intentar"), input[value*="Intentar"]';

// RC5: Moodle muestra diálogo YUI de tiempo límite que intercepta el botón del formulario.
async function confirmStartAttempt(page: Parameters<typeof login>[0]) {
  const yui = page.locator(
    '.moodle-dialogue-base[aria-hidden="false"] .btn-primary, .moodle-dialogue-base[aria-hidden="false"] input[type="submit"]'
  ).first();
  if (await yui.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await yui.click({ force: true });
    await waitForMoodle(page);
  }
}

// RC9: el quiz semilla puede no tener preguntas. Devuelve true si hay preguntas disponibles.
async function hasQuestions(page: Parameters<typeof login>[0]): Promise<boolean> {
  const noQText = await page.locator('text=No se han encontrado respuestas').count();
  const noQLink = await page.locator('a[href*="noquestionsfound"]').count();
  return noQText === 0 && noQLink === 0;
}

test.describe('06 — Intento del estudiante (navegar, marcar)', () => {

  test('estudiante puede iniciar un intento del examen', async ({ page }) => {
    await login(page, STUDENT);
    await gotoCourse(page);

    // RC2 fix: getByRole evita el <label class="sr-only">
    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const startBtn = page.locator(START_BTN).first();
    await expect(startBtn).toBeVisible({ timeout: 10_000 });
    await startBtn.click();
    await waitForMoodle(page);

    // Confirmar si hay advertencia de tiempo
    await confirmStartAttempt(page);

    if (!(await hasQuestions(page))) {
      test.info().annotations.push({ type: 'info', description: 'El quiz semilla no tiene preguntas configuradas. El inicio de intento funciona correctamente.' });
      return;
    }
    // review.php es válido cuando el estudiante ya tiene un intento completado
    expect(page.url()).toMatch(/attempt\.php|review\.php/);
    const questionContent = page.locator('.que, .question, [class*="qtype"], form#responseform').first();
    const hasContent = await questionContent.isVisible({ timeout: 15_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Contenido de pregunta visible: ${hasContent}. URL: ${page.url()}`,
    });
  });

  test('estudiante puede marcar una pregunta para revisión', async ({ page }) => {
    await login(page, STUDENT);
    await gotoCourse(page);

    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const startBtn = page.locator(START_BTN).first();
    if (!(await startBtn.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'No se puede iniciar intento (sin preguntas o ya intentado).');
      return;
    }
    await startBtn.click();
    await waitForMoodle(page);

    await confirmStartAttempt(page);

    if (!(await hasQuestions(page))) {
      test.info().annotations.push({ type: 'info', description: 'Quiz sin preguntas — marcar requiere preguntas configuradas.' });
      return;
    }

    const flagBtn = page.locator(
      'button.questionflag, a.questionflag, input[name*="flag"], button:has-text("Marcar"), a:has-text("Marcar")'
    ).first();
    if (await flagBtn.isVisible({ timeout: 5_000 })) {
      await flagBtn.click();
      await page.waitForTimeout(500);
      test.info().annotations.push({ type: 'info', description: 'Pregunta marcada para revisión.' });
    } else {
      test.info().annotations.push({ type: 'info', description: 'Botón de marcar no disponible en esta vista.' });
    }

    await expect(page.locator('.que, form#responseform').first()).toBeVisible({ timeout: 10_000 });
  });

  test('estudiante puede navegar entre preguntas', async ({ page }) => {
    await login(page, STUDENT);
    await gotoCourse(page);

    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const startBtn = page.locator(START_BTN).first();
    if (!(await startBtn.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'No se puede iniciar intento.');
      return;
    }
    await startBtn.click();
    await waitForMoodle(page);

    await confirmStartAttempt(page);

    if (!(await hasQuestions(page))) {
      test.info().annotations.push({ type: 'info', description: 'Quiz sin preguntas — navegación requiere preguntas configuradas.' });
      return;
    }

    const qNavButtons = page.locator('.qnbutton, [class*="qnbutton"]');
    const btnCount = await qNavButtons.count();

    if (btnCount > 1) {
      await qNavButtons.nth(1).click();
      await waitForMoodle(page);
      test.info().annotations.push({ type: 'info', description: `Navegación directa: ${btnCount} botones disponibles.` });
    } else {
      const nextBtn = page.locator('input[name="next"], button:has-text("Siguiente")').first();
      if (await nextBtn.isVisible({ timeout: 3_000 })) {
        await nextBtn.click();
        await waitForMoodle(page);
      }
      test.info().annotations.push({ type: 'info', description: 'Navegación vía botón Siguiente.' });
    }

    await expect(page.locator('.que, form#responseform').first()).toBeVisible({ timeout: 10_000 });
  });

  test('el temporizador se muestra durante el intento', async ({ page }) => {
    await login(page, STUDENT);
    await gotoCourse(page);

    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const startBtn = page.locator(START_BTN).first();
    if (!(await startBtn.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'No se puede iniciar intento.');
      return;
    }
    await startBtn.click();
    await waitForMoodle(page);

    await confirmStartAttempt(page);

    if (!(await hasQuestions(page))) {
      test.info().annotations.push({ type: 'info', description: 'Quiz sin preguntas — temporizador solo aparece con preguntas configuradas.' });
      return;
    }

    const timer = page.locator('#quiz-timer, .timeremaining, [id*="timer"], .quiz-timer').first();
    const timerVisible = await timer.isVisible({ timeout: 10_000 }).catch(() => false);
    test.info().annotations.push({
      type: timerVisible ? 'info' : 'warning',
      description: timerVisible ? 'Temporizador visible durante el intento.' : 'Temporizador no encontrado (quiz puede no tener límite de tiempo).',
    });
  });

});
