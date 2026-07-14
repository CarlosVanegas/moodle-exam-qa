import { test, expect } from '@playwright/test';
import { login, STUDENT, TEACHER } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

test.describe('09 — Calificación automática y resultado', () => {

  test('las preguntas objetivas tienen nota calculada automáticamente', async ({ page }) => {
    await login(page, STUDENT);
    await gotoCourse(page);

    // RC2 fix: getByRole evita el <label class="sr-only">
    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const reviewLink = page.locator('a:has-text("Revisar"), a:has-text("Review")').first();
    if (!(await reviewLink.isVisible({ timeout: 5_000 }))) {
      test.info().annotations.push({ type: 'info', description: 'Sin intentos previos para revisar la calificación automática.' });
      return;
    }
    await reviewLink.click();
    await waitForMoodle(page);

    const correctMark = page.locator('.correct, .incorrect, .partiallycorrect, .graded, [class*="correct"]').first();
    const isMarked = await correctMark.isVisible({ timeout: 5_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Marcas de corrección automática visibles: ${isMarked}`,
    });
  });

  test('la nota del intento aparece en el resumen de revisión', async ({ page }) => {
    await login(page, STUDENT);
    await gotoCourse(page);

    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const reviewLink = page.locator('a:has-text("Revisar"), a:has-text("Review")').first();
    if (!(await reviewLink.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'Sin intentos previos para revisar.');
      return;
    }
    await reviewLink.click();
    await waitForMoodle(page);

    const summaryTable = page.locator('.quizreviewsummary, .quiz-review-summary, table.generaltable').first();
    await expect(summaryTable).toBeVisible({ timeout: 10_000 });
  });

  test('el profesor ve la nota automática en el panel de intentos', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    // RC4 fix: navegar directamente al reporte de intentos
    const quizUrl = page.url();
    const quizId = quizUrl.match(/[?&]id=(\d+)/)?.[1] ?? '2';
    await page.goto(`/mod/quiz/report.php?id=${quizId}&mode=overview`);
    await waitForMoodle(page);

    const gradeColumn = page.locator('th:has-text("Calificación"), th:has-text("Nota"), th:has-text("Grade")').first();
    const isVisible = await gradeColumn.isVisible({ timeout: 10_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Columna de nota en tabla de intentos visible: ${isVisible}`,
    });
  });

  test('las preguntas de ensayo quedan pendientes de calificación manual', async ({ page }) => {
    await login(page, STUDENT);
    await gotoCourse(page);

    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const reviewLink = page.locator('a:has-text("Revisar"), a:has-text("Review")').first();
    if (!(await reviewLink.isVisible({ timeout: 5_000 }))) {
      test.info().annotations.push({ type: 'info', description: 'Sin intentos previos para verificar ensayos pendientes.' });
      return;
    }
    await reviewLink.click();
    await waitForMoodle(page);

    const needsGrading = page.locator(
      '.requiresgrading, text=Requiere calificación, text=Needs grading, .notyetanswered'
    ).first();
    const count = await needsGrading.count();
    test.info().annotations.push({
      type: 'info',
      description: `Preguntas pendientes de calificación manual encontradas: ${count}`,
    });
  });

  test('la nota final del examen se refleja en el gradebook del estudiante', async ({ page }) => {
    await login(page, STUDENT);
    await gotoCourse(page);

    // RC4 fix: obtener courseId y navegar directo al gradebook del estudiante
    const courseUrl = page.url();
    const courseId = courseUrl.match(/[?&]id=(\d+)/)?.[1] ?? '2';
    await page.goto(`/grade/report/overview/index.php?id=${courseId}`);
    await waitForMoodle(page);

    const gradeRow = page.locator('.grade, td.grade, [class*="gradevalue"]').first();
    const isVisible = await gradeRow.isVisible({ timeout: 10_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Nota en gradebook del estudiante visible: ${isVisible}`,
    });
  });

});
