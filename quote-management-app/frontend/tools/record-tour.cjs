// Records the product tour shown by Home > Watch tour (src/assets/media/quote-management-tour.*).
//
// Needs Playwright and ffmpeg, which are not project dependencies:
//   npm install --no-save playwright && npx playwright install chromium
// and a running app with demo data: a FAILED quote whose external ID is QM_TOUR_EXTERNAL_ID, with errors on its failed step.
// Use a demo account and fake data only; everything on screen ends up in the video.
//
//   QM_TOUR_BASE=http://127.0.0.1:8081 QM_TOUR_USER=demo QM_TOUR_PASS=... QM_TOUR_EXTERNAL_ID=708649176 \
//     node tools/record-tour.cjs <output folder>
//
// It prints the recorded .webm and the time each part starts (seconds). Then encode (the first 0.6 s is blank):
//   ffmpeg -i <webm> -ss 0.6 -vf "fps=24,scale=1280:720" -c:v libx264 -preset slow -crf 29 -pix_fmt yuv420p -movflags +faststart -an quote-management-tour.mp4
//   ffmpeg -i quote-management-tour.mp4 -c:v libvpx -b:v 0 -crf 36 -deadline good -cpu-used 2 -pix_fmt yuv420p -an quote-management-tour.webm
//   ffmpeg -ss 13 -i quote-management-tour.mp4 -frames:v 1 -vf scale=960:-2 -q:v 4 quote-management-tour.jpg
// and update tourChapters in quote-list.controller.js with the printed times minus 0.6.
const { chromium } = require('playwright');
const out = process.argv[2];
const BASE = process.env.QM_TOUR_BASE || 'http://127.0.0.1:8081';
const USER = process.env.QM_TOUR_USER || 'demo';
const PASS = process.env.QM_TOUR_PASS || '';
const EXTERNAL_ID = process.env.QM_TOUR_EXTERNAL_ID || '708649176';
if (!out) { console.error('Usage: node tools/record-tour.cjs <output folder>'); process.exit(1); }
const overlay = () => {
  const make = () => {
    if (document.getElementById('tour-cap')) return;
    const cap = document.createElement('div'); cap.id = 'tour-cap';
    cap.setAttribute('style', 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(16px);z-index:2147483646;display:flex;align-items:center;gap:12px;padding:11px 22px 11px 12px;border-radius:999px;background:rgba(10,18,52,.92);color:#fff;font:600 17px/1.3 Inter,system-ui,sans-serif;box-shadow:0 18px 40px -12px rgba(0,0,0,.55);opacity:0;transition:opacity .35s,transform .35s;pointer-events:none;max-width:86vw;white-space:nowrap');
    cap.innerHTML = '<span id="tour-no" style="display:grid;place-items:center;min-width:30px;height:30px;border-radius:50%;background:#2a58d0;font:700 15px Inter,sans-serif"></span><span id="tour-text"></span>';
    document.body.appendChild(cap);
    const cur = document.createElement('div'); cur.id = 'tour-cursor';
    cur.setAttribute('style', 'position:fixed;left:-40px;top:-40px;z-index:2147483647;width:26px;height:26px;pointer-events:none;transition:transform .08s;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))');
    cur.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 9.5-6.5 1.6L9.8 20z" fill="#fff" stroke="#0a1234" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    document.addEventListener('mousemove', e => { cur.style.left = e.clientX - 3 + 'px'; cur.style.top = e.clientY - 2 + 'px'; }, true);
    document.addEventListener('mousedown', e => {
      const r = document.createElement('div');
      r.setAttribute('style', `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;border:3px solid #2a58d0;z-index:2147483645;pointer-events:none;opacity:.9;transition:transform .5s ease-out,opacity .5s ease-out`);
      document.body.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(1.9)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  window.__cap = (text, no) => {
    make();
    const cap = document.getElementById('tour-cap');
    if (!text) { cap.style.opacity = '0'; cap.style.transform = 'translateX(-50%) translateY(16px)'; return; }
    document.getElementById('tour-text').textContent = text;
    document.getElementById('tour-no').textContent = no || '';
    document.getElementById('tour-no').style.display = no ? 'grid' : 'none';
    cap.style.opacity = '1'; cap.style.transform = 'translateX(-50%)';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', make); else make();
};
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
  const page = await ctx.newPage();
  await page.addInitScript(overlay);
  const t0 = Date.now(); const marks = {};
  const mark = name => { marks[name] = ((Date.now() - t0) / 1000).toFixed(1); };
  const sleep = ms => page.waitForTimeout(ms);
  const cap = async (text, no) => { if (no && !marks['step' + no]) mark('step' + no); await page.evaluate(([t, n]) => window.__cap && window.__cap(t, n), [text, no]); };
  const to = async loc => { await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); await page.mouse.move(b.x + Math.min(b.width / 2, 60 + b.width * .25), b.y + b.height / 2, { steps: 28 }); await sleep(250); };
  const click = async loc => { await to(loc); await loc.click(); };
  const scrollTo = async y => { await page.evaluate(y => window.scrollTo({ top: y, behavior: 'smooth' }), y); await sleep(900); };

  // 1. Sign in
  await page.goto(BASE + '/login'); await sleep(1200);
  await cap('Sign in with your organization SSO, or with a username and password', '1'); mark('login');
  await to(page.locator('button:has-text("Continue with")').first()); await sleep(1600);
  await click(page.locator('#login-username')); await page.keyboard.type(USER, { delay: 110 }); await sleep(300);
  await click(page.locator('#login-password')); await page.keyboard.type(PASS, { delay: 110 }); await sleep(600);
  await click(page.locator('button[type=submit]')); 

  // 2. Home
  await page.waitForSelector('.qm-kpi-card'); await sleep(1500); mark('home');
  await cap('Home shows your 25 newest quotes as soon as you sign in', '2'); await sleep(900);
  await to(page.locator('.qm-kpi-card').nth(0)); await sleep(700);
  for (const i of [1, 2, 3]) { await to(page.locator('.qm-kpi-card').nth(i)); await sleep(650); }
  await cap('Totals for the list, then the filters', '2'); await scrollTo(260); await sleep(1500);

  // 3. Filter
  await cap('Filter by state, design status, category, channel or created date', '3');
  await to(page.locator('#quote-state')); await sleep(700);
  await page.evaluate(() => { const e = document.getElementById('quote-state'); const i = Array.from(e.options).findIndex(o => /failed/i.test(o.textContent)); e.selectedIndex = i; e.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(2600);
  await scrollTo(520); await sleep(1800);

  // 4. Open a quote
  await cap('Click a quote to open all of its details', '4');
  const link = page.locator('a.qm-link-button', { hasText: EXTERNAL_ID }).first();
  await to(link); await sleep(900); await link.click();
  await page.waitForSelector('.qm-spotlight'); await sleep(1800); mark('detail');
  await cap('The header shows the quote, its state, IDs, who created it and when', '4'); await sleep(3200);

  // 5. Journey and errors
  await scrollTo(300); await cap('The processing journey shows every step and where it stopped', '5'); await sleep(3000);
  await click(page.locator('#spotlight-steps')); await sleep(3600);
  await cap('View errors pops up the error details of the failed step', '5');
  await click(page.locator('#spotlight-errors')); await page.waitForSelector('#error-dialog'); await sleep(4200);
  await click(page.locator('#error-dialog-close')); await sleep(700);
  await click(page.locator('#spotlight-steps')); await sleep(900);

  // 6. Tabs
  await cap('Customer, sites, products, processing, errors and events are one click away', '6');
  const tabs = ['customer', 'sites', 'products', 'processing', 'errors', 'events'];
  for (const t of tabs) { await click(page.locator('#detail-tab-' + t)); await sleep(1700); if (t === 'customer') await scrollTo(760); }
  await scrollTo(0); await sleep(600);

  // 7. Search
  await cap('Search: choose what to look up by', '7');
  await click(page.locator('a.qm-nav-link', { hasText: 'Search' }).first()); await page.waitForSelector('.qm-lookup-tile'); await sleep(1800);
  for (const i of [0, 1, 2]) { await to(page.locator('.qm-lookup-tile').nth(i)); await sleep(700); }
  await click(page.locator('.qm-lookup-tile').nth(1)); await sleep(900);
  await cap('Enter the value, then press Search', '7');
  await page.keyboard.type(EXTERNAL_ID, { delay: 120 }); await sleep(600); await page.keyboard.press('Enter');
  await page.waitForSelector('quote-table tbody tr'); await sleep(3000);
  await cap('Open the match for its full details, or use Support tickets to list the quotes linked to a ticket', '7'); await sleep(3800);
  await cap('That is the tour. Home and Search are in the menu on the left.'); await sleep(3200);
  mark('end');
  await ctx.close();
  const video = await page.video().path();
  console.log(JSON.stringify({ video, marks }));
  await browser.close();
})();
