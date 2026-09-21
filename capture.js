import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const brainDir = 'C:\\Users\\DAM2P\\.gemini\\antigravity\\brain\\bca63568-e047-4694-879a-6a0b0fa4469e';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  // 1. Desktop Hero preview
  await page.setViewport({ width: 1440, height: 1200 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => {
    sessionStorage.setItem('qw_offer_seen', 'true');
    const popup = document.querySelector('.offer-popup');
    if (popup) popup.style.display = 'none';
    document.querySelectorAll('[data-reveal]').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.classList.add('is-revealed');
    });
  });
  await new Promise(r => setTimeout(r, 800));

  const heroEl = await page.$('[data-qw-hero]');
  if (heroEl) {
    const desktopPath = path.join(brainDir, 'preview_desktop.png');
    await heroEl.screenshot({ path: desktopPath });
    console.log('Saved hero desktop preview:', desktopPath);
  }

  // 2. Ambientes de la web section
  const envEl = await page.$('#ambientes');
  if (envEl) {
    await page.evaluate(el => el.scrollIntoView(), envEl);
    await new Promise(r => setTimeout(r, 600));
    const envPath = path.join(brainDir, 'preview_ambientes.png');
    await envEl.screenshot({ path: envPath });
    console.log('Saved ambientes preview:', envPath);
  }

  // 3. Desktop Demos section
  const demosEl = await page.$('#demos');
  if (demosEl) {
    await page.evaluate(el => el.scrollIntoView(), demosEl);
    await new Promise(r => setTimeout(r, 600));
    const demosPath = path.join(brainDir, 'preview_demos.png');
    await demosEl.screenshot({ path: demosPath });
    console.log('Saved demos preview:', demosPath);
  }

  // 4. Proyectos Reales section
  const workEl = await page.$('#proyectos');
  if (workEl) {
    await page.evaluate(el => el.scrollIntoView(), workEl);
    await new Promise(r => setTimeout(r, 600));
    const workPath = path.join(brainDir, 'preview_work.png');
    await workEl.screenshot({ path: workPath });
    console.log('Saved work preview:', workPath);
  }

  // 5. Mobile Hero preview
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => {
    sessionStorage.setItem('qw_offer_seen', 'true');
    const popup = document.querySelector('.offer-popup');
    if (popup) popup.style.display = 'none';
    document.querySelectorAll('[data-reveal]').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.classList.add('is-revealed');
    });
  });
  await new Promise(r => setTimeout(r, 600));
  const mobilePath = path.join(brainDir, 'preview_mobile.png');
  await page.screenshot({ path: mobilePath, fullPage: false });
  console.log('Saved mobile preview:', mobilePath);

  await browser.close();
}

capture().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
