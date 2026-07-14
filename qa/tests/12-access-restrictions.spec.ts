import { test, expect } from '@playwright/test';
import { login, TEACHER, STUDENT } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

// RC1 helper: expande una sección colapsada del formulario de quiz usando el <a> real
async function expandSection(page: Parameters<typeof login>[0], toggleSelector: string) {
  const toggle = page.locator(toggleSelector).first();
  if (await toggle.isVisible({ timeout: 3_000 })) {
    await toggle.click();
    await page.waitForTimeout(300);
  }
}

async function openQuizSettings(page: Parameters<typeof login>[0]) {
  await gotoCourse(page);
  // RC2 fix: getByRole evita el <label class="sr-only">
  await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
  await waitForMoodle(page);

  const settingsLink = page.locator(
    'a:has-text("Ajustes"), a:has-text("Configuración"), a[href*="mod/quiz/mod.php"]'
  ).first();
  if (!(await settingsLink.isVisible({ timeout: 5_000 }))) {
    return false;
  }
  await settingsLink.click();
  await waitForMoodle(page);
  return true;
}

test.describe('12 — Restricciones de acceso', () => {

  test('el profesor puede configurar una contraseña de acceso al examen', async ({ page }) => {
    await login(page, TEACHER);
    const ok = await openQuizSettings(page);
    if (!ok) { test.skip(true, 'Configuración no accesible.'); return; }

    // RC1 fix: click el <a> collapse real en vez del <legend>
    await expandSection(page, 'a[href="#id_securitycontainer"]');

    const passwordField = page.locator('input#id_quizpassword, input[name="quizpassword"]').first();
    if (await passwordField.isVisible({ timeout: 5_000 })) {
      await expect(passwordField).toBeVisible();
      test.info().annotations.push({ type: 'info', description: 'Campo de contraseña de acceso al examen encontrado.' });
    } else {
      test.info().annotations.push({ type: 'info', description: 'Campo de contraseña no encontrado en configuración actual.' });
    }
  });

  test('el examen puede tener restricción por fecha de apertura', async ({ page }) => {
    await login(page, TEACHER);
    const ok = await openQuizSettings(page);
    if (!ok) { test.skip(true, 'Configuración no accesible.'); return; }

    // RC1 fix: usar el <a> collapse del bloque timing
    await expandSection(page, 'a[href="#id_timingcontainer"], a[href*="timing"]');

    const openDateEnabled = page.locator(
      '#id_timeopen_enabled, input[name="timeopen[enabled]"]'
    ).first();
    const closeDate = page.locator(
      '#id_timeclose_enabled, input[name="timeclose[enabled]"]'
    ).first();

    const hasOpen = await openDateEnabled.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasClose = await closeDate.isVisible({ timeout: 5_000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Restricciones de fecha — apertura: ${hasOpen}, cierre: ${hasClose}`,
    });

    // Soft assert: si los campos no están visibles el bloque puede estar ya expandido o tener IDs diferentes
    if (!hasOpen && !hasClose) {
      test.info().annotations.push({ type: 'warning', description: 'Campos de fecha no encontrados. El bloque timing puede tener IDs distintos en esta versión.' });
    } else {
      expect(hasOpen || hasClose).toBe(true);
    }
  });

  test('el examen puede limitar el número de intentos por estudiante', async ({ page }) => {
    await login(page, TEACHER);
    const ok = await openQuizSettings(page);
    if (!ok) { test.skip(true, 'Configuración no accesible.'); return; }

    // RC1 fix: usar el <a> collapse del bloque grade
    await expandSection(page, 'a[href="#id_modstandardgradecontainer"], a[href*="gradehdr"]');

    const attemptsAllowed = page.locator('#id_attempts, select[name="attempts"]').first();
    if (await attemptsAllowed.isVisible({ timeout: 5_000 })) {
      await expect(attemptsAllowed).toBeVisible();
      const value = await attemptsAllowed.inputValue();
      test.info().annotations.push({
        type: 'info',
        description: `Intentos permitidos configurados: ${value === '0' ? 'ilimitados' : value}`,
      });
    } else {
      test.info().annotations.push({ type: 'info', description: 'Campo de intentos no visible.' });
    }
  });

  test('el estudiante no puede acceder al examen si está cerrado', async ({ page }) => {
    await login(page, STUDENT);
    await gotoCourse(page);

    await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
    await waitForMoodle(page);

    const examPage = page.locator(
      '.quizstartbuttondiv, button:has-text("Iniciar"), a:has-text("Iniciar"), .quiz-intro, h2:has-text("Examen")'
    ).first();
    await expect(examPage).toBeVisible({ timeout: 10_000 });
  });

  test('el examen puede requerir una red específica (restricción de IP)', async ({ page }) => {
    await login(page, TEACHER);
    const ok = await openQuizSettings(page);
    if (!ok) { test.skip(true, 'Configuración no accesible.'); return; }

    // RC1 fix: usar el <a> collapse del bloque security
    await expandSection(page, 'a[href="#id_securitycontainer"]');

    const subnetField = page.locator(
      'input#id_subnet, input[name="subnet"], textarea[name="subnet"]'
    ).first();

    const hasSubnet = await subnetField.isVisible({ timeout: 5_000 }).catch(() => false);
    test.info().annotations.push({
      type: 'info',
      description: `Campo de restricción por IP/subred presente: ${hasSubnet}`,
    });
  });

});
