import { chromium, FullConfig } from '@playwright/test';
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../docker/.env') });

const BASE_URL = process.env.MOODLE_URL ?? 'http://localhost:8080';
const AUTH_DIR = path.resolve(__dirname, '.auth');

function curlLogin(user: string, pass: string, cookieFile: string): boolean {
  try {
    // Get logintoken
    const tokenResult = spawnSync('bash', ['-c',
      `curl -sc "${cookieFile}" -m 30 "${BASE_URL}/login/index.php" 2>/dev/null | grep -oP 'name="logintoken" value="\\K[^"]+' | head -1`
    ], { timeout: 40_000, encoding: 'utf8' });
    const token = tokenResult.stdout.trim();
    if (!token) return false;

    // POST login and follow all redirects
    const loginResult = spawnSync('bash', ['-c',
      `curl -s -b "${cookieFile}" -c "${cookieFile}" -L -m 600 -o /dev/null -w '%{http_code}' \
       "${BASE_URL}/login/index.php" \
       -d "username=${user}&password=${pass}&logintoken=${token}" 2>/dev/null`
    ], { timeout: 650_000, encoding: 'utf8' });

    const statusCode = loginResult.stdout.trim();
    return statusCode === '200';
  } catch {
    return false;
  }
}

function curlGet(cookieFile: string, url: string, timeoutSeconds = 120): void {
  try {
    spawnSync('bash', ['-c',
      `curl -s -b "${cookieFile}" -c "${cookieFile}" -L -m ${timeoutSeconds} -o /dev/null "${BASE_URL}${url}" 2>/dev/null`
    ], { timeout: (timeoutSeconds + 5) * 1000 });
  } catch { /* ignore */ }
}

export default async function globalSetup(_config: FullConfig) {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Step 1: Build theme CSS via CLI (fast, avoids per-request CSS compilation)
  try {
    console.log('[global-setup] Building theme CSS...');
    execSync(
      'docker exec -u www-data ges_moodle php /var/www/html/admin/cli/build_theme_css.php --themes=boost',
      { timeout: 120_000, stdio: 'pipe' }
    );
    console.log('[global-setup] Theme CSS built.');
  } catch (e) {
    console.warn('[global-setup] Theme build error:', (e as Error).message?.slice(0, 60));
  }

  // Step 2: Authenticated curl warmup to pre-compile PHP templates
  // This triggers Moodle's template cache building WITHOUT a browser (much faster)
  console.log('[global-setup] Authenticated curl warmup (may take several minutes on cold start)...');
  const adminCookies = path.join(AUTH_DIR, 'admin-curl.txt');
  const adminUser = process.env.MOODLE_USERNAME ?? 'admin';
  const adminPass = process.env.MOODLE_PASSWORD ?? 'Admin1234!';

  const loginOk = curlLogin(adminUser, adminPass, adminCookies);
  if (loginOk) {
    console.log('[global-setup] Admin curl login successful, fetching key pages...');
    // Fetch pages that trigger template compilation
    curlGet(adminCookies, '/my/', 300);
    curlGet(adminCookies, '/course/view.php?id=2', 120);
    console.log('[global-setup] Curl warmup complete.');
  } else {
    console.warn('[global-setup] Curl login failed — templates may not be pre-cached.');
  }

  // Step 3: Browser logins — save auth state for each user role
  const users = [
    { key: 'admin',   user: adminUser, pass: adminPass },
    { key: 'teacher', user: process.env.TEACHER_USER   ?? 'profesor01',   pass: process.env.TEACHER_PASS   ?? 'Profesor1234!' },
    { key: 'student', user: process.env.STUDENT_USER   ?? 'estudiante01', pass: process.env.STUDENT_PASS   ?? 'Estudiante1234!' },
  ];

  const browser = await chromium.launch();

  for (const u of users) {
    const stateFile = path.join(AUTH_DIR, `${u.key}.json`);
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    const page = await ctx.newPage();

    try {
      await page.goto('/login/index.php', { timeout: 30_000 });
      // Wait for ToggleSensitive AJAX render to complete before filling password
      await page.waitForLoadState('networkidle', { timeout: 60_000 });
      await page.fill('#username', u.user);
      await page.fill('#password', u.pass);
      await page.click('#loginbtn');
      await page.waitForURL(/\/my\/|\/dashboard\//, { waitUntil: 'commit', timeout: 120_000 });
      await ctx.storageState({ path: stateFile });
      console.log(`[global-setup] Auth saved: ${u.key}`);
    } catch (e) {
      console.warn(`[global-setup] Auth save failed for ${u.key}:`, (e as Error).message?.slice(0, 80));
    } finally {
      await ctx.close();
    }
  }

  await browser.close();
  console.log('[global-setup] Done.');
}
