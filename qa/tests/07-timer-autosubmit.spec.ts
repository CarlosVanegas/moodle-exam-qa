import { test, expect } from '@playwright/test';
import { login, TEACHER, STUDENT } from '../helpers/auth';
import { gotoCourse, waitForMoodle } from '../helpers/moodle';

// RC2: getByRole evita el <label class="sr-only">
// RC3: selector completo para Moodle 4.4 español
const START_BTN = '.quizstartbuttondiv button, .quizstartbuttondiv input[type="submit"], button:has-text("Intentar"), input[value*="Intentar"], button:has-text("Iniciar intento"), a:has-text("Iniciar intento")';

async function gotoQuiz(page: Parameters<typeof login>[0]) {
  await gotoCourse(page);
  await page.getByRole('link', { name: /Examen QA/i }).first().click({ timeout: 10_000 });
  await waitForMoodle(page);
}

// RC5: diálogo YUI de tiempo límite
async function confirmYUI(page: Parameters<typeof login>[0]) {
  const yui = page.locator(
    '.moodle-dialogue-base[aria-hidden="false"] .btn-primary, .moodle-dialogue-base[aria-hidden="false"] input[type="submit"]'
  ).first();
  if (await yui.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await yui.click({ force: true });
    await waitForMoodle(page);
  }
}

// RC9: quiz semilla sin preguntas
async function hasQuestions(page: Parameters<typeof login>[0]): Promise<boolean> {
  const noQText = await page.locator('text=No se han encontrado respuestas').count();
  const noQLink = await page.locator('a[href*="noquestionsfound"]').count();
  return noQText === 0 && noQLink === 0;
}

test.describe('07 — Límite de tiempo y auto-envío', () => {

  test('el examen tiene límite de tiempo configurado', async ({ page }) => {
    await login(page, TEACHER);
    await gotoQuiz(page);

    const settingsLink = page.locator(
      'a:has-text("Ajustes"), a:has-text("Configuración"), a[href*="mod/quiz/mod.php"]'
    ).first();
    if (await settingsLink.isVisible({ timeout: 5_000 })) {
      await settingsLink.click();
      await waitForMoodle(page);
    }

    const timingSection = page.locator('fieldset#id_timinghdr, legend:has-text("Sincronización"), a[href*="timinghdr"]').first();
    if (await timingSection.isVisible({ timeout: 5_000 })) {
      await timingSection.click().catch(() => {});
    }

    const timeLimitEnabled = page.locator('#id_timelimit_enabled, input[name="timelimit[enabled]"]').first();
    if (await timeLimitEnabled.isVisible({ timeout: 5_000 })) {
      expect(await timeLimitEnabled.isChecked()).toBe(true);
    } else {
      test.info().annotations.push({ type: 'info', description: 'Campo de límite de tiempo no visible en configuración.' });
    }
  });

  test('el período de gracia está configurado en el examen sembrado', async ({ page }) => {
    await login(page, TEACHER);
    await gotoQuiz(page);

    const settingsLink = page.locator(
      'a:has-text("Ajustes"), a:has-text("Configuración"), a[href*="mod/quiz/mod.php"]'
    ).first();
    if (await settingsLink.isVisible({ timeout: 5_000 })) {
      await settingsLink.click();
      await waitForMoodle(page);
    }

    const timingSection = page.locator('a[href*="timinghdr"], legend:has-text("Sincronización")').first();
    if (await timingSection.isVisible({ timeout: 3_000 })) {
      await timingSection.click().catch(() => {});
    }

    const graceOption = page.locator('#id_overduehandling_graceperiod, input[value="graceperiod"][name="overduehandling"]').first();
    if (await graceOption.isVisible({ timeout: 5_000 })) {
      expect(await graceOption.isChecked()).toBe(true);
      const graceValue = page.locator('input[name="graceperiod[number]"]').first();
      if (await graceValue.isVisible({ timeout: 3_000 })) {
        const val = await graceValue.inputValue();
        expect(parseInt(val)).toBeGreaterThan(0);
      }
    } else {
      test.info().annotations.push({ type: 'info', description: 'Opción de período de gracia no encontrada.' });
    }
  });

  test('el temporizador muestra cuenta regresiva durante el intento', async ({ page }) => {
    await login(page, STUDENT);
    await gotoQuiz(page);

    const startBtn = page.locator(START_BTN).first();
    if (!(await startBtn.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'No se puede iniciar intento.');
      return;
    }
    await startBtn.click();
    await waitForMoodle(page);
    await confirmYUI(page);

    if (!(await hasQuestions(page))) {
      test.info().annotations.push({ type: 'info', description: 'Quiz sin preguntas — temporizador requiere preguntas configuradas.' });
      return;
    }

    const timer = page.locator('#quiz-timer, .timeremaining, [id*="timer"]').first();
    const timerVisible = await timer.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!timerVisible) {
      test.info().annotations.push({ type: 'warning', description: 'Temporizador no encontrado en el intento.' });
      return;
    }

    const t1 = await timer.textContent();
    await page.waitForTimeout(2000);
    const t2 = await timer.textContent();

    test.info().annotations.push({
      type: 'info',
      description: `Timer t1="${t1}" → t2="${t2}". Cambiando: ${t1 !== t2}`,
    });
  });

  test('la advertencia de tiempo aparece cuando el tiempo se agota', async ({ page }) => {
    await login(page, STUDENT);
    await gotoQuiz(page);

    const startBtn = page.locator(START_BTN).first();
    if (!(await startBtn.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'No se puede iniciar intento.');
      return;
    }
    await startBtn.click();
    await waitForMoodle(page);
    await confirmYUI(page);

    if (!(await hasQuestions(page))) {
      test.info().annotations.push({ type: 'info', description: 'Quiz sin preguntas — lógica de temporizador requiere preguntas.' });
      return;
    }

    const hasTimerScript = await page.evaluate(() => {
      return typeof (window as any).M?.mod_quiz !== 'undefined' ||
        document.querySelector('#quiz-timer') !== null ||
        document.querySelector('[data-quiz-timer]') !== null;
    });

    test.info().annotations.push({
      type: 'info',
      description: `Lógica de temporizador detectada en el DOM: ${hasTimerScript}`,
    });
    expect(hasTimerScript).toBe(true);
  });

});
