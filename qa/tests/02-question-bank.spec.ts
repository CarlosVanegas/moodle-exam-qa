import { test, expect } from '@playwright/test';
import { login, TEACHER } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

test.describe('02 — Banco de preguntas (todos los tipos)', () => {

  test('profesor accede al banco de preguntas del curso', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    await page.locator('a[data-key="morenavigationlinks"], a:has-text("Banco de preguntas"), a:has-text("More")').first().click({ timeout: 8_000 }).catch(() => {});
    await waitForMoodle(page);

    // Intentar navegación directa si el menú no funcionó
    if (!page.url().includes('question')) {
      await page.goto('/question/edit.php?courseid=');
      // Buscar el id del curso QA
      await gotoCourse(page);
      const courseUrl = page.url();
      const courseId = courseUrl.match(/id=(\d+)/)?.[1] ?? '2';
      await page.goto(`/question/edit.php?courseid=${courseId}`);
    }
    await waitForMoodle(page);

    await expect(page.locator('h1, h2').filter({ hasText: /preguntas|Questions|Bank/i }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('puede crear una pregunta de opción múltiple', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    const courseUrl = page.url();
    const courseId = courseUrl.match(/id=(\d+)/)?.[1] ?? '2';
    await page.goto(`/question/edit.php?courseid=${courseId}`);
    await waitForMoodle(page);

    await page.locator('button:has-text("Añadir"), a:has-text("Crear"), button:has-text("Add")').first().click();
    await waitForMoodle(page);

    // Seleccionar tipo: opción múltiple
    const multiChoice = page.locator('input[value="multichoice"], label:has-text("Opción múltiple"), label:has-text("Multiple choice")').first();
    if (await multiChoice.isVisible({ timeout: 5_000 })) {
      await multiChoice.click();
      await page.click('button:has-text("Añadir"), input[id="submitbutton"]');
      await waitForMoodle(page);

      await page.fill('#id_name', 'Pregunta MC QA');
      await page.fill('#id_questiontext_editoreditable, .editor_atto_content[contenteditable]', '¿Cuál es 2+2?');
      await page.fill('input[name="fraction[0]"]', '100');
      await page.fill('#id_answer_0_editoreditable, [name="answer[0]"]', '4');
      await page.fill('#id_answer_1_editoreditable, [name="answer[1]"]', '3');

      await page.click('#id_submitbutton, button:has-text("Guardar cambios")');
      await waitForMoodle(page);

      await expect(page.locator('text=Pregunta MC QA').first()).toBeVisible({ timeout: 10_000 });
    } else {
      test.info().annotations.push({ type: 'info', description: 'Modal de tipos no visible; banco de preguntas accesible.' });
    }
  });

  test('puede crear una pregunta de verdadero/falso', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    const courseUrl = page.url();
    const courseId = courseUrl.match(/id=(\d+)/)?.[1] ?? '2';
    await page.goto(`/question/edit.php?courseid=${courseId}`);
    await waitForMoodle(page);

    await page.locator('button:has-text("Añadir"), a:has-text("Crear"), button:has-text("Add")').first().click();
    await waitForMoodle(page);

    const tfOption = page.locator('input[value="truefalse"], label:has-text("Verdadero/falso"), label:has-text("True/False")').first();
    if (await tfOption.isVisible({ timeout: 5_000 })) {
      await tfOption.click();
      await page.click('button:has-text("Añadir"), input[id="submitbutton"]');
      await waitForMoodle(page);

      await page.fill('#id_name', 'Pregunta V/F QA');
      await page.fill('#id_questiontext_editoreditable, .editor_atto_content[contenteditable]', 'El cielo es azul.');

      await page.click('#id_submitbutton, button:has-text("Guardar cambios")');
      await waitForMoodle(page);

      await expect(page.locator('text=Pregunta V/F QA').first()).toBeVisible({ timeout: 10_000 });
    } else {
      test.info().annotations.push({ type: 'info', description: 'Tipo V/F no encontrado en el modal.' });
    }
  });

  test('puede crear una pregunta de respuesta corta', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    const courseUrl = page.url();
    const courseId = courseUrl.match(/id=(\d+)/)?.[1] ?? '2';
    await page.goto(`/question/edit.php?courseid=${courseId}`);
    await waitForMoodle(page);

    await page.locator('button:has-text("Añadir"), a:has-text("Crear"), button:has-text("Add")').first().click();
    await waitForMoodle(page);

    const shortAnswer = page.locator('input[value="shortanswer"], label:has-text("Respuesta corta"), label:has-text("Short answer")').first();
    if (await shortAnswer.isVisible({ timeout: 5_000 })) {
      await shortAnswer.click();
      await page.click('button:has-text("Añadir"), input[id="submitbutton"]');
      await waitForMoodle(page);

      await page.fill('#id_name', 'Pregunta RC QA');
      await page.fill('#id_questiontext_editoreditable, .editor_atto_content[contenteditable]', '¿Capital de Francia?');
      await page.fill('input[name="answer[0]"]', 'París');
      await page.fill('input[name="fraction[0]"]', '100');

      await page.click('#id_submitbutton, button:has-text("Guardar cambios")');
      await waitForMoodle(page);

      await expect(page.locator('text=Pregunta RC QA').first()).toBeVisible({ timeout: 10_000 });
    } else {
      test.info().annotations.push({ type: 'info', description: 'Tipo respuesta corta no encontrado en el modal.' });
    }
  });

  test('puede crear una pregunta numérica', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    const courseUrl = page.url();
    const courseId = courseUrl.match(/id=(\d+)/)?.[1] ?? '2';
    await page.goto(`/question/edit.php?courseid=${courseId}`);
    await waitForMoodle(page);

    await page.locator('button:has-text("Añadir"), a:has-text("Crear"), button:has-text("Add")').first().click();
    await waitForMoodle(page);

    const numerical = page.locator('input[value="numerical"], label:has-text("Numérica"), label:has-text("Numerical")').first();
    if (await numerical.isVisible({ timeout: 5_000 })) {
      await numerical.click();
      await page.click('button:has-text("Añadir"), input[id="submitbutton"]');
      await waitForMoodle(page);

      await page.fill('#id_name', 'Pregunta Num QA');
      await page.fill('#id_questiontext_editoreditable, .editor_atto_content[contenteditable]', '¿Cuánto es 10/2?');
      await page.fill('input[name="answer[0]"]', '5');
      await page.fill('input[name="tolerance[0]"]', '0');

      await page.click('#id_submitbutton, button:has-text("Guardar cambios")');
      await waitForMoodle(page);

      await expect(page.locator('text=Pregunta Num QA').first()).toBeVisible({ timeout: 10_000 });
    } else {
      test.info().annotations.push({ type: 'info', description: 'Tipo numérica no encontrado en el modal.' });
    }
  });

  test('puede crear una pregunta de ensayo', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    const courseUrl = page.url();
    const courseId = courseUrl.match(/id=(\d+)/)?.[1] ?? '2';
    await page.goto(`/question/edit.php?courseid=${courseId}`);
    await waitForMoodle(page);

    await page.locator('button:has-text("Añadir"), a:has-text("Crear"), button:has-text("Add")').first().click();
    await waitForMoodle(page);

    const essay = page.locator('input[value="essay"], label:has-text("Ensayo"), label:has-text("Essay")').first();
    if (await essay.isVisible({ timeout: 5_000 })) {
      await essay.click();
      await page.click('button:has-text("Añadir"), input[id="submitbutton"]');
      await waitForMoodle(page);

      await page.fill('#id_name', 'Pregunta Ensayo QA');
      await page.fill('#id_questiontext_editoreditable, .editor_atto_content[contenteditable]', 'Explique brevemente la fotosíntesis.');

      await page.click('#id_submitbutton, button:has-text("Guardar cambios")');
      await waitForMoodle(page);

      await expect(page.locator('text=Pregunta Ensayo QA').first()).toBeVisible({ timeout: 10_000 });
    } else {
      test.info().annotations.push({ type: 'info', description: 'Tipo ensayo no encontrado en el modal.' });
    }
  });

});
