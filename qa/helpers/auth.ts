import { Page } from '@playwright/test';

export const ADMIN    = { user: process.env.MOODLE_USERNAME ?? 'admin',        pass: process.env.MOODLE_PASSWORD ?? 'Admin1234!' };
export const TEACHER  = { user: process.env.TEACHER_USER   ?? 'profesor01',    pass: process.env.TEACHER_PASS   ?? 'Profesor1234!' };
export const STUDENT  = { user: process.env.STUDENT_USER   ?? 'estudiante01',  pass: process.env.STUDENT_PASS   ?? 'Estudiante1234!' };

export async function login(page: Page, creds: { user: string; pass: string }): Promise<void> {
  await page.goto('/login/index.php');
  await page.fill('#username', creds.user);
  await page.fill('#password', creds.pass);
  await page.click('#loginbtn');
  await page.waitForURL(/\/my\/|\/dashboard|\/course\//);
}

export async function logout(page: Page): Promise<void> {
  await page.goto('/login/logout.php?sesskey=' + await getSessionKey(page));
  await page.waitForURL(/\/login\/index\.php/);
}

async function getSessionKey(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).M?.cfg?.sesskey ?? '');
}
