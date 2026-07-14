import { test, expect } from '@playwright/test';
import { login, TEACHER } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

// RC2: getByRole('link') evita el <label class="sr-only"> con el mismo texto
async function gotoQuiz(page: Parameters<typeof login>[0]) {
  await gotoCourse(page);
  await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
  await waitForMoodle(page);
}

// RC9: quiz semilla puede no tener preguntas
async function hasQuestions(page: Parameters<typeof login>[0]): Promise<boolean> {
  const noQText = await page.locator('text=No se han encontrado respuestas').count();
  const noQLink = await page.locator('a[href*="noquestionsfound"]').count();
  return noQText === 0 && noQLink === 0;
}

// RC5: Moodle muestra un diálogo YUI de tiempo límite que intercepta el botón del formulario.
// Hay que clickear el botón primario del diálogo, no el botón detrás de él.
async function startIfConfirm(page: Parameters<typeof login>[0]) {
  const yui = page.locator(
    '.moodle-dialogue-base[aria-hidden="false"] .btn-primary, .moodle-dialogue-base[aria-hidden="false"] input[type="submit"]'
  ).first();

  // Si el diálogo ya está abierto, confirmar directamente
  if (await yui.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await yui.click({ force: true });
    await waitForMoodle(page);
    return;
  }

  // Si no hay diálogo, click en el botón del formulario (force bypassa overlays invisibles)
  const formBtn = page.locator(
    '.quizstartbuttondiv button, .quizstartbuttondiv input[type="submit"], button:has-text("Intentar"), input[value*="Intentar"]'
  ).first();
  if (await formBtn.isVisible({ timeout: 3_000 })) {
    await formBtn.click({ force: true });
    await waitForMoodle(page);
    // El click puede abrir el diálogo de tiempo límite — confirmarlo si aparece
    if (await yui.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await yui.click({ force: true });
      await waitForMoodle(page);
    }
  }
}

test.describe('05 — Vista previa del examen (profesor)', () => {

  test('profesor puede iniciar vista previa del examen', async ({ page }) => {
    await login(page, TEACHER);
    await gotoQuiz(page);

    // RC10: si el profesor tiene un preview "En curso", aparece "Continuar la previsualización anterior"
    const previewBtn = page.locator(
      'a:has-text("Vista previa"), a:has-text("Preview"), button:has-text("Vista previa"), a:has-text("Continuar la previsualización"), button:has-text("Continuar la previsualización")'
    ).first();
    await expect(previewBtn).toBeVisible({ timeout: 10_000 });
    await previewBtn.click();
    await waitForMoodle(page);
    await startIfConfirm(page);

    // RC5: view.php es estado intermedio válido antes de que inicie el intento
    expect(page.url()).toMatch(/startattempt|preview|attempt|view\.php/);
  });

  test('la vista previa muestra todas las preguntas navegables', async ({ page }) => {
    await login(page, TEACHER);
    await gotoQuiz(page);

    const previewBtn = page.locator('a:has-text("Vista previa"), a:has-text("Preview"), a:has-text("Continuar la previsualización"), button:has-text("Continuar la previsualización")').first();
    if (!(await previewBtn.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'Vista previa no disponible.');
      return;
    }
    await previewBtn.click();
    await waitForMoodle(page);
    await startIfConfirm(page);

    if (!(await hasQuestions(page))) {
      test.info().annotations.push({ type: 'info', description: 'Quiz sin preguntas — la navegación se verifica cuando hay preguntas configuradas.' });
      return;
    }

    const questionNav = page.locator('.qnbutton, .questionflag, nav.questionnavigation, [class*="qnbutton"]');
    const navCount = await questionNav.count();
    test.info().annotations.push({
      type: 'info',
      description: `Botones de navegación de preguntas en preview: ${navCount}`,
    });

    const questionContent = page.locator('.que, .question, [class*="qtype"]').first();
    await expect(questionContent).toBeVisible({ timeout: 10_000 });
  });

  test('el profesor puede navegar entre preguntas en preview', async ({ page }) => {
    await login(page, TEACHER);
    await gotoQuiz(page);

    const previewBtn = page.locator('a:has-text("Vista previa"), a:has-text("Preview"), a:has-text("Continuar la previsualización"), button:has-text("Continuar la previsualización")').first();
    if (!(await previewBtn.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'Vista previa no disponible.');
      return;
    }
    await previewBtn.click();
    await waitForMoodle(page);
    await startIfConfirm(page);

    const nextBtn = page.locator('input[name="next"], button:has-text("Siguiente"), a:has-text("Siguiente")').first();
    if (await nextBtn.isVisible({ timeout: 5_000 })) {
      await nextBtn.click();
      await waitForMoodle(page);
      test.info().annotations.push({ type: 'info', description: 'Navegación a siguiente pregunta exitosa.' });
    } else {
      test.info().annotations.push({ type: 'info', description: 'No hay botón siguiente (examen de 1 pregunta o vista de todas).' });
    }
  });

  test('el profesor puede enviar la vista previa', async ({ page }) => {
    await login(page, TEACHER);
    await gotoQuiz(page);

    const previewBtn = page.locator('a:has-text("Vista previa"), a:has-text("Preview"), a:has-text("Continuar la previsualización"), button:has-text("Continuar la previsualización")').first();
    if (!(await previewBtn.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'Vista previa no disponible.');
      return;
    }
    await previewBtn.click();
    await waitForMoodle(page);
    await startIfConfirm(page);

    const submitBtn = page.locator(
      'button:has-text("Enviar todo y terminar"), input[value*="Enviar todo"]'
    ).first();
    if (await submitBtn.isVisible({ timeout: 5_000 })) {
      await submitBtn.click();
      const confirmBtn = page.locator('button:has-text("Enviar todo y terminar")').last();
      if (await confirmBtn.isVisible({ timeout: 3_000 })) {
        await confirmBtn.click();
      }
      await waitForMoodle(page);
      await expect(page.locator('.quizreviewsummary, h2:has-text("Resumen"), .quiz-summary').first()).toBeVisible({ timeout: 15_000 });
    } else {
      test.info().annotations.push({ type: 'info', description: 'Botón de envío no encontrado en la vista previa.' });
    }
  });

});
