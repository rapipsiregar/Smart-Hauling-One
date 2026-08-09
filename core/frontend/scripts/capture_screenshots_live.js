import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.resolve('docs/presentation-screenshots');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  
  // Set dark mode preferred color scheme
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);

  const BASE_URL = 'http://localhost:3000';

  // Helper to ensure guide mode is OFF
  async function ensureGuideModeOff() {
    const isPressed = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Toggle guide mode"]');
      return btn ? btn.getAttribute('aria-pressed') === 'true' : false;
    });
    if (isPressed) {
      await page.click('button[aria-label="Toggle guide mode"]');
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // Helper to ensure guide mode is ON
  async function ensureGuideModeOn() {
    const isPressed = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Toggle guide mode"]');
      return btn ? btn.getAttribute('aria-pressed') === 'true' : false;
    });
    if (!isPressed) {
      await page.click('button[aria-label="Toggle guide mode"]');
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // Helper to ensure dark mode
  async function ensureDarkMode() {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sg_theme', 'dark');
    });
  }

  // Helper to wait until backend status is online and loader disappears
  async function waitForPageReady() {
    await page.waitForFunction(() => {
      const spinner = document.querySelector('.animate-spin');
      const dataUnavailablePill = Array.from(document.querySelectorAll('div')).find(
        d => d.textContent && d.textContent.includes('Data unavailable')
      );
      return !spinner && !dataUnavailablePill;
    }, { timeout: 10000 }).catch(() => {
      console.log('Timeout waiting for spinner/online status, continuing...');
    });
    await new Promise(r => setTimeout(r, 1000));
  }

  const items = [
    { route: '/', name: '01-dashboard-standard', guide: false },
    { route: '/', name: '02-dashboard-guidemode', guide: true },
    { route: '/ledger', name: '03-ledger-standard', guide: false },
    { route: '/ledger', name: '04-ledger-guidemode', guide: true },
    { route: '/crossing', name: '05-crossing-standard', guide: false },
    { route: '/crossing', name: '06-crossing-guidemode', guide: true },
    { route: '/cctv-history', name: '08-cctv-history-standard', guide: false },
    { route: '/cctv-history', name: '09-cctv-history-guidemode', guide: true },
    { route: '/fleet', name: '11-fleet-standard', guide: false },
    { route: '/fleet', name: '12-fleet-guidemode', guide: true },
    { route: '/map', name: '14-map-standard', guide: false },
    { route: '/map', name: '15-map-guidemode', guide: true },
    { route: '/reports', name: '16-reports-standard', guide: false },
    { route: '/reports', name: '17-reports-guidemode', guide: true },
    { route: '/settings', name: '18-settings-standard', guide: false },
    { route: '/settings', name: '19-settings-guidemode', guide: true },
  ];

  console.log('Starting screenshot generation with live backend validation...');

  for (const item of items) {
    console.log(`Capturing ${item.name} (${item.route})...`);
    await page.goto(`${BASE_URL}${item.route}`, { waitUntil: 'networkidle0' });
    await ensureDarkMode();
    
    if (item.guide) {
      await ensureGuideModeOn();
    } else {
      await ensureGuideModeOff();
    }

    await waitForPageReady();
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${item.name}.png`), fullPage: false });
  }

  // --- Modals & Detail Views ---

  // 1. Crossing inspector / detail view
  console.log('Capturing 07-crossing-detail-modal.png...');
  await page.goto(`${BASE_URL}/crossing`, { waitUntil: 'networkidle0' });
  await ensureDarkMode();
  await ensureGuideModeOff();
  await waitForPageReady();
  await page.evaluate(() => {
    const card = document.querySelector('.cursor-pointer, button');
    if (card) card.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '07-crossing-detail-modal.png') });

  // 2. CCTV Player / Inspector view
  console.log('Capturing 10-cctv-player-modal.png...');
  await page.goto(`${BASE_URL}/cctv-history`, { waitUntil: 'networkidle0' });
  await ensureDarkMode();
  await ensureGuideModeOff();
  await waitForPageReady();
  await page.evaluate(() => {
    const playBtn = document.querySelector('button');
    if (playBtn) playBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '10-cctv-player-modal.png') });

  // 3. Add Truck Modal on Fleet page
  console.log('Capturing 13-fleet-add-truck-modal.png...');
  await page.goto(`${BASE_URL}/fleet`, { waitUntil: 'networkidle0' });
  await ensureDarkMode();
  await ensureGuideModeOff();
  await waitForPageReady();
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const addBtn = buttons.find(b => b.textContent?.includes('Add Truck') || b.textContent?.includes('Add'));
    if (addBtn) addBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '13-fleet-add-truck-modal.png') });

  // 4. Notifications Dropdown in Header
  console.log('Capturing 20-notifications-dropdown.png...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  await ensureDarkMode();
  await ensureGuideModeOff();
  await waitForPageReady();
  await page.evaluate(() => {
    const bellBtn = document.querySelector('button[aria-label="Notifications"]');
    if (bellBtn) bellBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '20-notifications-dropdown.png') });

  console.log('All live screenshots captured successfully!');
  await browser.close();
}

run().catch(err => {
  console.error('Error running screenshot script:', err);
  process.exit(1);
});
