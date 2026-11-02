import { chromium } from '@playwright/test';
import fs from 'node:fs';

fs.mkdirSync('artifacts', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto('http://127.0.0.1:4173/?test=1');
  await page.getByRole('button', { name: 'START MISSION', exact: true }).waitFor({ timeout: 90_000 });
  if (await page.evaluate(() => '__DUSKLINE__' in window)) throw new Error('Development diagnostics leaked into production');
  await page.screenshot({ path: 'artifacts/production-menu.png' });
  // Exercise production quality controls before entering the mission.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  for (const quality of ['medium', 'low', 'high']) {
    const button = page.getByRole('button', { name: quality, exact: true });
    await button.click();
    if (await button.getAttribute('aria-pressed') !== 'true') throw new Error(`Quality ${quality} not selected`);
  }
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'START MISSION', exact: true }).click();
  await page.locator('.phase-playing').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/production-game.png' });
  if (!await page.evaluate(() => !!document.pointerLockElement)) throw new Error('Production mouse capture failed');
  await page.keyboard.press('p');
  await page.getByRole('button', { name: 'RESUME MISSION', exact: true }).waitFor();
  for (const url of ['/assets/models/environment.glb', '/assets/models/vxr7.glb', '/assets/audio/shot.wav', '/THIRD-PARTY-NOTICES.txt']) {
    const response = await page.request.get(`http://127.0.0.1:4173${url}`);
    if (response.status() !== 200) throw new Error(`Production asset unavailable: ${url}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Production verified: live WebGL menu, three graphics modes, mission startup, pointer lock, pause, packaged assets, no page/HTTP errors; development diagnostics absent.');
} finally { await browser.close(); }
