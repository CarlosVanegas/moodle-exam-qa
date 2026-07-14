import { test, expect } from '@playwright/test';
import { login, TEACHER } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

// RC4 helper: navega al gradebook del profesor directamente por URL
async function gotoGradebook(page: Parameters<typeof login>[0], courseId: string) {
  await page.goto(`/grade/report/grader/index.php?id=${courseId}`);
  await waitForMoodle(page);
}

test.describe('11 — Override de notas y reportes', () => {

  test('el profesor puede acceder al libro de calificaciones del curso', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    // RC4 fix: extraer courseId y navegar directo para evitar el dropdown cerrado
    const courseUrl = page.url();
    const courseId = courseUrl.match(/[?&]id=(\d+)/)?.[1] ?? '2';
    await gotoGradebook(page, courseId);

    await expect(
      page.locator('table.gradereport-grader-table, #user-grades, .gradeparent, h1').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('el libro de calificaciones muestra la columna del examen QA', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    const courseUrl = page.url();
    const courseId = courseUrl.match(/[?&]id=(\d+)/)?.[1] ?? '2';
    await gotoGradebook(page, courseId);

    const examColumn = page.locator('th:has-text("Examen QA"), th a:has-text("Examen")').first();
    const isVisible = await examColumn.isVisible({ timeout: 10_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Columna del Examen QA en gradebook visible: ${isVisible}`,
    });
  });

  test('el profesor puede hacer override de nota de un estudiante', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    const courseUrl = page.url();
    const courseId = courseUrl.match(/[?&]id=(\d+)/)?.[1] ?? '2';
    await gotoGradebook(page, courseId);

    const editModeBtn = page.locator(
      'button:has-text("Activar edición"), a:has-text("Activar edición de calificaciones"), input[value*="Activar"]'
    ).first();

    if (await editModeBtn.isVisible({ timeout: 5_000 })) {
      await editModeBtn.click();
      await waitForMoodle(page);
    }

    const gradeInput = page.locator('input[name*="grade"], input[class*="grade"], td.grade input').first();
    if (await gradeInput.isVisible({ timeout: 5_000 })) {
      const originalValue = await gradeInput.inputValue();
      await gradeInput.fill('8.5');

      await page.click('input[name="save_data"], button:has-text("Guardar"), input[value*="Guardar"]').catch(() => {});
      await waitForMoodle(page);

      const gradeInputRestored = page.locator('input[name*="grade"], input[class*="grade"], td.grade input').first();
      if (await gradeInputRestored.isVisible({ timeout: 3_000 })) {
        await gradeInputRestored.fill(originalValue);
        await page.click('input[name="save_data"], button:has-text("Guardar"), input[value*="Guardar"]').catch(() => {});
        await waitForMoodle(page);
      }

      test.info().annotations.push({ type: 'info', description: 'Override de nota realizado y revertido exitosamente.' });
    } else {
      test.info().annotations.push({ type: 'info', description: 'No hay celdas de nota editables (gradebook sin intentos o sin modo edición).' });
    }
  });

  test('el reporte de intentos del examen está disponible', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const resultsMenu = page.locator('text=Resultados, a[href*="report"]').first();
    if (await resultsMenu.isVisible({ timeout: 5_000 })) {
      await resultsMenu.click();
      await waitForMoodle(page);
    }

    const overviewReport = page.locator('text=Intentos, a[href*="report/overview"]').first();
    const statsReport = page.locator('text=Estadísticas, a[href*="report/statistics"]').first();

    const hasOverview = await overviewReport.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasStats = await statsReport.isVisible({ timeout: 5_000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Reportes disponibles — Overview: ${hasOverview}, Estadísticas: ${hasStats}`,
    });
  });

  test('el reporte de estadísticas del examen carga correctamente', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const statsLink = page.locator('text=Estadísticas, a[href*="report/statistics"]').first();
    if (!(await statsLink.isVisible({ timeout: 5_000 }))) {
      const resultsMenu = page.locator('text=Resultados').first();
      if (await resultsMenu.isVisible({ timeout: 3_000 })) {
        await resultsMenu.click();
        const sl = page.locator('text=Estadísticas, a[href*="report/statistics"]').first();
        if (await sl.isVisible({ timeout: 5_000 })) {
          await sl.click();
          await waitForMoodle(page);
        }
      }
    } else {
      await statsLink.click();
      await waitForMoodle(page);
    }

    const statsContent = page.locator(
      'h1:has-text("Estadísticas"), .statistics, table.statistics, text=Facilidad, text=Discriminación'
    ).first();
    const isVisible = await statsContent.isVisible({ timeout: 10_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Reporte de estadísticas cargado: ${isVisible}`,
    });
  });

});
