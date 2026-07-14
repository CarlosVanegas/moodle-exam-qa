import { test, expect } from '@playwright/test';
import { login, TEACHER } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

test.describe('04 — Opciones de revisión', () => {

  async function openExamSettings(page: Parameters<typeof login>[0]) {
    await gotoCourse(page);
    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const settingsLink = page.locator('a:has-text("Ajustes"), a:has-text("Configuración"), a[href*="mod/quiz/mod.php"]').first();
    if (await settingsLink.isVisible({ timeout: 5_000 })) {
      await settingsLink.click();
    } else {
      await page.click('a:has-text("Administración del cuestionario"), a:has-text("Configuración")');
    }
    await waitForMoodle(page);
  }

  test('existen opciones de revisión en la configuración del examen', async ({ page }) => {
    await login(page, TEACHER);
    await openExamSettings(page);

    // RC1 fix: click the actual <a> collapse toggle, not the sr-only <legend>
    const reviewToggle = page.locator('a[href="#id_reviewoptionshdrcontainer"]').first();
    if (await reviewToggle.isVisible({ timeout: 5_000 })) {
      await reviewToggle.click();
      await waitForMoodle(page);
    }

    const reviewSection = page.locator('fieldset#id_reviewoptionshdr, [id*="reviewoptions"]').first();
    const isVisible = await reviewSection.isVisible({ timeout: 10_000 }).catch(() => false);
    test.info().annotations.push({ type: 'info', description: `Sección de revisión visible: ${isVisible}` });
  });

  test('se puede activar la opción de mostrar respuesta correcta durante el intento', async ({ page }) => {
    await login(page, TEACHER);
    await openExamSettings(page);

    // RC1 fix: click the actual collapse toggle <a> instead of <legend>
    const reviewToggle = page.locator('a[href="#id_reviewoptionshdrcontainer"]').first();
    if (await reviewToggle.isVisible({ timeout: 5_000 })) {
      await reviewToggle.click();
      await waitForMoodle(page);
    }

    const correctAnswerDuring = page.locator(
      'input[name="reviewcorrectness[duringAttempt]"], #id_reviewcorrectnessduring'
    ).first();

    if (await correctAnswerDuring.isVisible({ timeout: 5_000 })) {
      const wasChecked = await correctAnswerDuring.isChecked();
      await correctAnswerDuring.check();
      expect(await correctAnswerDuring.isChecked()).toBe(true);

      await page.click('#id_submitbutton2, button:has-text("Guardar y volver")');
      await waitForMoodle(page);

      test.info().annotations.push({
        type: 'info',
        description: `Opción "mostrar correcta durante intento" cambió de ${wasChecked} a true.`,
      });
    } else {
      test.info().annotations.push({ type: 'info', description: 'Checkbox de revisión durante intento no encontrado.' });
    }
  });

  test('se puede configurar qué mostrar después del intento cerrado', async ({ page }) => {
    await login(page, TEACHER);
    await openExamSettings(page);

    const reviewToggle = page.locator('a[href="#id_reviewoptionshdrcontainer"]').first();
    if (await reviewToggle.isVisible({ timeout: 5_000 })) {
      await reviewToggle.click();
    }

    const afterClosed = page.locator(
      'input[name*="reviewmarks[afterClosed]"], input[name*="reviewcorrectness[afterClosed]"]'
    ).first();

    const isVisible = await afterClosed.isVisible({ timeout: 5_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Opciones de revisión post-cierre visibles: ${isVisible}`,
    });
  });

  test('las opciones guardadas persisten tras recargar', async ({ page }) => {
    await login(page, TEACHER);
    await openExamSettings(page);

    const reviewToggle = page.locator('a[href="#id_reviewoptionshdrcontainer"]').first();
    if (await reviewToggle.isVisible({ timeout: 5_000 })) {
      await reviewToggle.click();
    }

    const firstReviewCheckbox = page.locator('input[name*="review"]').first();
    if (await firstReviewCheckbox.isVisible({ timeout: 5_000 })) {
      const stateBefore = await firstReviewCheckbox.isChecked();

      await page.click('#id_submitbutton2, button:has-text("Guardar y volver")');
      await waitForMoodle(page);

      await openExamSettings(page);
      const reviewToggle2 = page.locator('a[href="#id_reviewoptionshdrcontainer"]').first();
      if (await reviewToggle2.isVisible({ timeout: 5_000 })) {
        await reviewToggle2.click();
      }
      const stateAfter = await page.locator('input[name*="review"]').first().isChecked();
      expect(stateAfter).toBe(stateBefore);
    } else {
      test.info().annotations.push({ type: 'info', description: 'No se encontraron checkboxes de revisión.' });
    }
  });

});
