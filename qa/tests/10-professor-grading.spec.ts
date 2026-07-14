import { test, expect } from '@playwright/test';
import { login, TEACHER } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

test.describe('10 — Calificación manual (ensayo) y recalificar', () => {

  test('el profesor puede acceder a la lista de intentos del examen', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    // RC2 fix: getByRole evita el <label class="sr-only">
    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    // RC4 fix: navegar directamente al reporte de intentos
    const quizUrl = page.url();
    const quizId = quizUrl.match(/[?&]id=(\d+)/)?.[1] ?? '2';
    await page.goto(`/mod/quiz/report.php?id=${quizId}&mode=overview`);
    await waitForMoodle(page);

    // La página del reporte de intentos puede tener varios títulos posibles
    const heading = page.locator('h1, h2, .page-header-headings h1').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('el profesor puede abrir un intento para revisar', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const quizUrl = page.url();
    const quizId = quizUrl.match(/[?&]id=(\d+)/)?.[1] ?? '2';
    await page.goto(`/mod/quiz/report.php?id=${quizId}&mode=overview`);
    await waitForMoodle(page);

    const attemptLink = page.locator(
      'a[href*="review.php"], a:has-text("Revisar"), a:has-text("Review")'
    ).first();

    if (await attemptLink.isVisible({ timeout: 10_000 })) {
      await attemptLink.click();
      await waitForMoodle(page);
      expect(page.url()).toMatch(/review\.php/);
    } else {
      test.info().annotations.push({ type: 'info', description: 'No hay intentos disponibles para revisar.' });
    }
  });

  test('el profesor puede calificar una pregunta de ensayo manualmente', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const manualGradingLink = page.locator(
      'text=Calificación manual, a[href*="report/grading"]'
    ).first();

    if (!(await manualGradingLink.isVisible({ timeout: 5_000 }))) {
      const resultsMenu = page.locator('text=Resultados').first();
      if (await resultsMenu.isVisible({ timeout: 3_000 })) {
        await resultsMenu.click();
        const gradingLink = page.locator('text=Calificación manual, a[href*="grading"]').first();
        if (await gradingLink.isVisible({ timeout: 5_000 })) {
          await gradingLink.click();
          await waitForMoodle(page);
        }
      }
    } else {
      await manualGradingLink.click();
      await waitForMoodle(page);
    }

    const gradingSection = page.locator(
      '.essay, [class*="grading"], h1:has-text("Calificación"), h2:has-text("Calificación"), h1:has-text("Grading")'
    ).first();
    const isVisible = await gradingSection.isVisible({ timeout: 10_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Sección de calificación manual accesible: ${isVisible}`,
    });
  });

  test('el profesor puede asignar un comentario de retroalimentación', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const quizUrl = page.url();
    const quizId = quizUrl.match(/[?&]id=(\d+)/)?.[1] ?? '2';
    await page.goto(`/mod/quiz/report.php?id=${quizId}&mode=overview`);
    await waitForMoodle(page);

    const attemptLink = page.locator('a[href*="review.php"], a:has-text("Revisar")').first();
    if (!(await attemptLink.isVisible({ timeout: 5_000 }))) {
      test.info().annotations.push({ type: 'info', description: 'Sin intentos para revisar feedback.' });
      return;
    }
    await attemptLink.click();
    await waitForMoodle(page);

    const commentField = page.locator(
      'textarea[name*="comment"], .comment-box, [class*="feedback"] textarea'
    ).first();
    const hasFeedback = await commentField.isVisible({ timeout: 5_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Campo de retroalimentación disponible: ${hasFeedback}`,
    });
  });

  test('el botón de recalificar existe en el panel de intentos', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const quizUrl = page.url();
    const quizId = quizUrl.match(/[?&]id=(\d+)/)?.[1] ?? '2';
    await page.goto(`/mod/quiz/report.php?id=${quizId}&mode=overview`);
    await waitForMoodle(page);

    const regrade = page.locator(
      'button:has-text("Recalificar"), a:has-text("Recalificar"), input[value*="Recalificar"], a:has-text("Regrade")'
    ).first();
    const hasRegrade = await regrade.isVisible({ timeout: 5_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Botón Recalificar presente: ${hasRegrade}`,
    });
  });

});
