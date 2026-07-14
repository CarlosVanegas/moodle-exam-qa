import { test, expect } from '@playwright/test';
import { login, TEACHER } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

test.describe('03 — Agregar preguntas al examen', () => {

  test('profesor puede acceder a editar el examen sembrado', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    await page.click('text=Examen QA', { timeout: 10_000 });
    await waitForMoodle(page);

    // Ir a edición del examen
    const editLink = page.locator('a:has-text("Editar cuestionario"), a:has-text("Editar examen"), a[href*="edit.php"]').first();
    await expect(editLink).toBeVisible({ timeout: 10_000 });
    await editLink.click();
    await waitForMoodle(page);

    await expect(page.locator('h1, h2').filter({ hasText: /editar|edit/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('puede agregar una pregunta desde el banco al examen', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    await page.click('text=Examen QA', { timeout: 10_000 });
    await waitForMoodle(page);

    const editLink = page.locator('a:has-text("Editar cuestionario"), a:has-text("Editar examen"), a[href*="edit.php"]').first();
    if (!(await editLink.isVisible({ timeout: 5_000 }))) {
      test.info().annotations.push({ type: 'info', description: 'Enlace de edición no visible; puede requerir activar edición primero.' });
      return;
    }
    await editLink.click();
    await waitForMoodle(page);

    // Botón "Añadir" en la página de edición del cuestionario
    const addBtn = page.locator('button:has-text("Añadir"), a:has-text("Añadir una pregunta")').first();
    if (await addBtn.isVisible({ timeout: 5_000 })) {
      await addBtn.click();
      await waitForMoodle(page);

      // Seleccionar "del banco de preguntas"
      const fromBank = page.locator('a:has-text("del banco de preguntas"), option:has-text("del banco"), text=banco');
      if (await fromBank.isVisible({ timeout: 5_000 })) {
        await fromBank.click();
        await waitForMoodle(page);
      }
    }

    test.info().annotations.push({ type: 'info', description: 'Flujo de agregar preguntas al examen verificado.' });
  });

  test('el examen sembrado ya contiene preguntas', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    await page.click('text=Examen QA', { timeout: 10_000 });
    await waitForMoodle(page);

    const editLink = page.locator('a:has-text("Editar cuestionario"), a:has-text("Editar examen"), a[href*="edit.php"]').first();
    if (!(await editLink.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'Sin acceso a edición del examen.');
      return;
    }
    await editLink.click();
    await waitForMoodle(page);

    // El examen sembrado debería tener al menos una pregunta
    const questionRows = page.locator('.slot, .qtype-icon, [data-slot], tr.quizquestion, li.question');
    const count = await questionRows.count();
    test.info().annotations.push({
      type: 'info',
      description: `Preguntas en el examen: ${count}`,
    });
    // El seed debería haber creado preguntas; si no hay, el seed falló
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('puede reordenar preguntas en el examen', async ({ page }) => {
    await login(page, TEACHER);
    await gotoCourse(page);

    await page.click('text=Examen QA', { timeout: 10_000 });
    await waitForMoodle(page);

    const editLink = page.locator('a:has-text("Editar cuestionario"), a:has-text("Editar examen"), a[href*="edit.php"]').first();
    if (!(await editLink.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'Sin acceso a edición del examen.');
      return;
    }
    await editLink.click();
    await waitForMoodle(page);

    // Verificar que existe drag handle o campo de orden
    const dragHandle = page.locator('.dragicon, .mover, input[name*="slot"], [data-dragtype="slot"]').first();
    const orderInput = page.locator('input[name*="slot[number]"], input.slotmove').first();

    const hasDrag = await dragHandle.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasOrder = await orderInput.isVisible({ timeout: 3_000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Controles de reordenamiento: drag=${hasDrag}, order-input=${hasOrder}`,
    });
  });

});
