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
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);

  const BASE_URL = 'http://localhost:3000';

  async function ensureDarkMode() {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sg_theme', 'dark');
    });
  }

  async function ensureGuideModeOff() {
    await page.evaluate(() => {
      localStorage.setItem('sg_guide', '0');
    });
    const isPressed = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Mode panduan"]') || document.querySelector('button[aria-label="Toggle guide mode"]');
      return btn ? btn.getAttribute('aria-pressed') === 'true' : false;
    });
    if (isPressed) {
      const btn = await page.$('button[aria-label="Mode panduan"]') || await page.$('button[aria-label="Toggle guide mode"]');
      if (btn) await btn.click();
      await new Promise(r => setTimeout(r, 400));
    }
  }

  async function ensureGuideModeOn() {
    await page.evaluate(() => {
      localStorage.setItem('sg_guide', '1');
    });
    const isPressed = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Mode panduan"]') || document.querySelector('button[aria-label="Toggle guide mode"]');
      return btn ? btn.getAttribute('aria-pressed') === 'true' : false;
    });
    if (!isPressed) {
      const btn = await page.$('button[aria-label="Mode panduan"]') || await page.$('button[aria-label="Toggle guide mode"]');
      if (btn) await btn.click();
      await new Promise(r => setTimeout(r, 400));
    }
  }

  console.log('--- Capturing Video Test Bench & Live Run Flow Screenshots ---');

  // 1. Settings Page: Video Test Bench Standard View
  console.log('Capturing 21-test-bench-settings-standard.png...');
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2' });
  await ensureDarkMode();
  await ensureGuideModeOff();
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '21-test-bench-settings-standard.png') });

  // 2. Settings Page: Video Test Bench Guide Mode
  console.log('Capturing 22-test-bench-settings-guidemode.png...');
  await ensureGuideModeOn();
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '22-test-bench-settings-guidemode.png') });
  await ensureGuideModeOff();

  // Define test run mock datasets for the 3 progress states
  const mockQueuedRun = {
    id: "run-test-01",
    status: "queued",
    cameraCode: "CAM-GATE-A",
    cameraName: "CK Gate A",
    folder: "gate-a",
    model: "yolo-v8-ocr-hauling",
    total: 9,
    completed: 0,
    failed: 0,
    message: "Menyiapkan pipeline deteksi untuk 9 klip video…",
    startedAt: new Date().toISOString(),
    completedAt: null,
    current: {
      cameraCode: "CAM-GATE-A",
      cameraName: "CK Gate A",
      name: "gate-a_001.mp4",
      relPath: "gate-a/gate-a_001.mp4",
    },
    progress: {
      video: "gate-a_001.mp4",
      frames_scanned: 0,
      frames_total: 150,
      reads: 0,
      ocr_reads: 0,
      voted_hull_id: "MEMINDAI…",
      vote_confidence: 0,
      distribution: [],
    },
    items: [
      { id: "1", video: "gate-a_001.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "running" },
      { id: "2", video: "gate-a_002.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "queued" },
      { id: "3", video: "gate-a_003.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "queued" },
      { id: "4", video: "gate-a_004.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "queued" },
      { id: "5", video: "gate-a_005.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "queued" },
      { id: "6", video: "gate-a_006.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "queued" },
      { id: "7", video: "gate-a_007.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "queued" },
      { id: "8", video: "gate-a_008.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "queued" },
      { id: "9", video: "gate-a_009.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "queued" },
    ],
  };

  const mockScanningRun = {
    id: "run-test-01",
    status: "running",
    cameraCode: "CAM-GATE-A",
    cameraName: "CK Gate A",
    folder: "gate-a",
    model: "yolo-v8-ocr-hauling",
    total: 9,
    completed: 2,
    failed: 0,
    message: "Memproses klip 3 dari 9: gate-a_003.mp4",
    startedAt: new Date().toISOString(),
    completedAt: null,
    current: {
      cameraCode: "CAM-GATE-A",
      cameraName: "CK Gate A",
      name: "gate-a_003.mp4",
      relPath: "gate-a/gate-a_003.mp4",
    },
    progress: {
      video: "gate-a_003.mp4",
      frames_scanned: 94,
      frames_total: 150,
      reads: 18,
      ocr_reads: 14,
      voted_hull_id: "B 9482 FBA",
      vote_confidence: 0.942,
      distribution: [
        { id: "B 9482 FBA", share: 0.78, winner: true },
        { id: "B 9482 FBB", share: 0.14, winner: false },
        { id: "B 9480 FBA", share: 0.08, winner: false },
      ],
    },
    items: [
      { id: "1", video: "gate-a_001.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "done", hullId: "B 9102 FBA", confidence: 96.5, reads: 22, ocrReads: 20 },
      { id: "2", video: "gate-a_002.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "done", hullId: "B 9234 FBB", confidence: 91.8, reads: 19, ocrReads: 17 },
      { id: "3", video: "gate-a_003.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "running", hullId: "B 9482 FBA", confidence: 94.2, reads: 18, ocrReads: 14 },
      { id: "4", video: "gate-a_004.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "queued" },
      { id: "5", video: "gate-a_005.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "queued" },
      { id: "6", video: "gate-a_006.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "queued" },
      { id: "7", video: "gate-a_007.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "queued" },
      { id: "8", video: "gate-a_008.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "queued" },
      { id: "9", video: "gate-a_009.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "queued" },
    ],
  };

  const mockDoneRun = {
    id: "run-test-01",
    status: "done",
    cameraCode: "CAM-GATE-A",
    cameraName: "CK Gate A",
    folder: "gate-a",
    model: "yolo-v8-ocr-hauling",
    total: 9,
    completed: 9,
    failed: 0,
    message: "Run selesai: 9/9 klip video berhasil diproses dan disimpan ke database.",
    startedAt: new Date(Date.now() - 45000).toISOString(),
    completedAt: new Date().toISOString(),
    current: null,
    progress: null,
    items: [
      { id: "1", video: "gate-a_001.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "done", hullId: "B 9102 FBA", confidence: 96.5, reads: 22, ocrReads: 20 },
      { id: "2", video: "gate-a_002.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "done", hullId: "B 9234 FBB", confidence: 91.8, reads: 19, ocrReads: 17 },
      { id: "3", video: "gate-a_003.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "done", hullId: "B 9482 FBA", confidence: 94.2, reads: 18, ocrReads: 16 },
      { id: "4", video: "gate-a_004.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "done", hullId: "B 9511 FBA", confidence: 98.1, reads: 25, ocrReads: 23 },
      { id: "5", video: "gate-a_005.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "done", hullId: "B 9600 FBC", confidence: 89.4, reads: 17, ocrReads: 14 },
      { id: "6", video: "gate-a_006.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "done", hullId: "B 9720 FBD", confidence: 95.0, reads: 21, ocrReads: 19 },
      { id: "7", video: "gate-a_007.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "done", hullId: "B 9801 FBE", confidence: 97.6, reads: 24, ocrReads: 22 },
      { id: "8", video: "gate-a_008.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "done", hullId: "B 9912 FBF", confidence: 93.3, reads: 20, ocrReads: 18 },
      { id: "9", video: "gate-a_009.mp4", cameraCode: "CAM-GATE-A", cameraName: "CK Gate A", status: "done", hullId: "B 9999 FBG", confidence: 99.0, reads: 28, ocrReads: 27 },
    ],
  };

  // Helper to inject mock run into dashboard page
  async function renderDashboardWithRun(mockRun, sessionWatch = "run-test-01") {
    await page.setRequestInterception(true);
    const requestHandler = (req) => {
      if (req.url().includes('/api/test-runs/active')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockRun),
        });
      } else if (req.url().includes('/api/test-runs/run-test-01')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockRun),
        });
      } else {
        req.continue();
      }
    };

    page.on('request', requestHandler);
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await ensureDarkMode();
    if (sessionWatch) {
      await page.evaluate((id) => sessionStorage.setItem('sg_test_run_watch', id), sessionWatch);
      await page.reload({ waitUntil: 'networkidle2' });
      await ensureDarkMode();
    }
    await new Promise(r => setTimeout(r, 600));
    return () => page.removeListener('request', requestHandler);
  }

  // 3. Live Run Progress 1: Starting / Queued State
  console.log('Capturing 23-live-run-01-started-queued.png...');
  let removeHandler = await renderDashboardWithRun(mockQueuedRun);
  await ensureGuideModeOff();
  await page.screenshot({ path: path.join(OUTPUT_DIR, '23-live-run-01-started-queued.png') });
  page.removeAllListeners('request');

  // 4. Live Run Progress 2: Active Scanning & Candidate Voting
  console.log('Capturing 24-live-run-02-scanning-progress.png...');
  removeHandler = await renderDashboardWithRun(mockScanningRun);
  await ensureGuideModeOff();
  await page.screenshot({ path: path.join(OUTPUT_DIR, '24-live-run-02-scanning-progress.png') });
  page.removeAllListeners('request');

  // 5. Live Run Progress 3: Run Completed
  console.log('Capturing 25-live-run-03-completed.png...');
  removeHandler = await renderDashboardWithRun(mockDoneRun);
  await ensureGuideModeOff();
  await page.screenshot({ path: path.join(OUTPUT_DIR, '25-live-run-03-completed.png') });
  page.removeAllListeners('request');

  // 6. Live Run HUD: Guide Mode View
  console.log('Capturing 26-live-run-guidemode.png...');
  removeHandler = await renderDashboardWithRun(mockScanningRun);
  await ensureGuideModeOn();
  await page.screenshot({ path: path.join(OUTPUT_DIR, '26-live-run-guidemode.png') });
  page.removeAllListeners('request');

  console.log('--- All Run Flow Screenshots Captured Successfully! ---');
  await browser.close();
}

run().catch(err => {
  console.error('Error capturing run flow screenshots:', err);
  process.exit(1);
});
