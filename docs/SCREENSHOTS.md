# Screenshot Automation

Automated screenshot capture using Playwright for README and documentation.

## Prerequisites

- Node.js 22+
- Dev server running on `http://localhost:3000`
- Playwright installed (`npx playwright install chromium`)

## Setup

```bash
# Install Playwright browser (one-time)
npx playwright install chromium

# Start dev server in another terminal
npm run dev
```

## Screenshot Script

Save this as `take-screenshots.mjs` in the project root, then run with `node take-screenshots.mjs`.

```js
import { chromium } from 'playwright';
import { join } from 'path';

const BASE = 'http://localhost:3000';
const OUT = join(import.meta.dirname, 'docs', 'screenshots');
const NAV_OPTS = { waitUntil: 'domcontentloaded', timeout: 60000 };

async function goAndWait(page, path, extraWait = 2000) {
  await page.goto(BASE + path, NAV_OPTS);
  await page.waitForTimeout(extraWait);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ── Desktop screenshots (1440x900) ────────────────────────────
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    deviceScaleFactor: 1,
  });

  // Guest cookie bypasses login — serves demo data
  await desktopContext.addCookies([{
    name: 'guest', value: 'true', domain: 'localhost', path: '/',
  }]);

  const page = await desktopContext.newPage();
  const shot = (name) => page.screenshot({ path: join(OUT, name), fullPage: false });

  // 01 - Dashboard
  console.log('Taking: 01-dashboard');
  await goAndWait(page, '/', 3000);
  await shot('01-dashboard.png');

  // 02 - Trades
  console.log('Taking: 02-trades');
  await goAndWait(page, '/trades');
  await shot('02-trades.png');

  // 03 - Journal
  console.log('Taking: 03-journal');
  await goAndWait(page, '/journal', 3000);
  await shot('03-journal.png');

  // 04 - Chart (TradingView needs extra time to load)
  console.log('Taking: 04-chart');
  await goAndWait(page, '/chart', 5000);
  await shot('04-chart.png');

  // 05 - Settings
  console.log('Taking: 05-settings');
  await goAndWait(page, '/settings');
  await shot('05-settings.png');

  // 06 - Login (fresh context without guest cookie)
  console.log('Taking: 06-login');
  const loginCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 }, colorScheme: 'dark', deviceScaleFactor: 1,
  });
  const loginPage = await loginCtx.newPage();
  await loginPage.goto(BASE + '/login', NAV_OPTS);
  await loginPage.waitForTimeout(1500);
  await loginPage.screenshot({ path: join(OUT, '06-login.png'), fullPage: false });
  await loginCtx.close();

  // 07 - Trade Modal (edit button is opacity-0 until hover, so click via JS)
  console.log('Taking: 07-trade-modal');
  await goAndWait(page, '/trades');
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('[title="Edit"]');
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (clicked) {
    await page.waitForTimeout(2000);
    await shot('07-trade-modal.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    console.log('  SKIP: No edit button found');
  }

  // 07-trade-hover (hover over first symbol in trade table)
  console.log('Taking: 07-trade-hover');
  await goAndWait(page, '/trades');
  const allTds = page.locator('table tbody tr td');
  const tdCount = await allTds.count();
  let hovered = false;
  for (let i = 0; i < Math.min(tdCount, 20); i++) {
    const text = (await allTds.nth(i).textContent() || '').trim();
    if (/^[A-Z]{2,5}$/.test(text)) {
      await allTds.nth(i).hover();
      await page.waitForTimeout(3000);
      await shot('07-trade-hover.png');
      hovered = true;
      break;
    }
  }
  if (!hovered) console.log('  SKIP: No symbol cell found');

  // 12 - Settings > Strategies
  console.log('Taking: 12-settings-strategies');
  await goAndWait(page, '/settings?tab=strategies');
  await shot('12-settings-strategies.png');

  // 13 - Alert Modal (open from chart page)
  console.log('Taking: 13-alert-modal');
  await goAndWait(page, '/chart', 5000);
  const alertBtn = page.locator('text=Alert').first();
  const bellIcon = page.locator('.lucide-bell').first();
  if (await alertBtn.count() > 0) {
    await alertBtn.click();
  } else if (await bellIcon.count() > 0) {
    await bellIcon.click();
  }
  await page.waitForTimeout(1500);
  await shot('13-alert-modal.png');
  await page.keyboard.press('Escape');

  await desktopContext.close();

  // ── Mobile screenshots (390x844, 2x DPR) ─────────────────────
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    deviceScaleFactor: 2,
    isMobile: true,
  });

  await mobileCtx.addCookies([{
    name: 'guest', value: 'true', domain: 'localhost', path: '/',
  }]);

  const mobile = await mobileCtx.newPage();
  const mShot = (name) => mobile.screenshot({ path: join(OUT, name), fullPage: false });

  console.log('Taking: 08-mobile-dashboard');
  await mobile.goto(BASE + '/', NAV_OPTS);
  await mobile.waitForTimeout(3000);
  await mShot('08-mobile-dashboard.png');

  console.log('Taking: 09-mobile-trades');
  await mobile.goto(BASE + '/trades', NAV_OPTS);
  await mobile.waitForTimeout(2000);
  await mShot('09-mobile-trades.png');

  console.log('Taking: 10-mobile-chart');
  await mobile.goto(BASE + '/chart', NAV_OPTS);
  await mobile.waitForTimeout(5000);
  await mShot('10-mobile-chart.png');

  console.log('Taking: 11-mobile-settings');
  await mobile.goto(BASE + '/settings', NAV_OPTS);
  await mobile.waitForTimeout(2000);
  await mShot('11-mobile-settings.png');

  await mobileCtx.close();
  await browser.close();
  console.log('\nAll screenshots saved to docs/screenshots/');
}

main().catch(e => { console.error(e); process.exit(1); });
```

## Output Files

| File | Page | Notes |
|---|---|---|
| `01-dashboard.png` | `/` | Dashboard with all widgets |
| `02-trades.png` | `/trades` | Trade log table |
| `03-journal.png` | `/journal` | Journal card view |
| `04-chart.png` | `/chart` | TradingView chart + watchlist |
| `05-settings.png` | `/settings` | Account settings |
| `06-login.png` | `/login` | Login page (no guest cookie) |
| `07-trade-modal.png` | `/trades` | Edit trade modal (opened via JS click) |
| `07-trade-hover.png` | `/trades` | Trade table with hover state |
| `08-mobile-dashboard.png` | `/` | Mobile dashboard |
| `09-mobile-trades.png` | `/trades` | Mobile trade log |
| `10-mobile-chart.png` | `/chart` | Mobile chart |
| `11-mobile-settings.png` | `/settings` | Mobile settings |
| `12-settings-strategies.png` | `/settings?tab=strategies` | Strategy checklists |
| `13-alert-modal.png` | `/chart` | Price alert modal |

## Key Techniques

### Guest Mode
Setting `guest=true` cookie bypasses authentication and serves demo data. The login page screenshot uses a separate browser context without this cookie.

### Hidden Elements (opacity-0)
Some UI elements (edit/delete buttons on trade rows) use `opacity-0 group-hover:opacity-100` and Playwright considers them "not visible" even after hover. Use `page.evaluate()` to click via JavaScript:

```js
await page.evaluate(() => {
  document.querySelector('[title="Edit"]').click();
});
```

### TradingView Widget
The TradingView chart loads inside an iframe and needs 3-5 seconds after DOM ready. Use `waitUntil: 'domcontentloaded'` (not `'networkidle'` — TradingView never goes fully idle) plus a generous `waitForTimeout`.

### GitHub Image Cache
When updating existing screenshots, GitHub's CDN caches the old versions. Add `?v=N` query params to image URLs in README.md to bust the cache:

```md
![Dashboard](docs/screenshots/01-dashboard.png?v=2)
```

Increment the version number each time you retake screenshots.

## Adding New Screenshots

1. Add the new page/modal navigation to the script
2. Use a numbered filename following the existing convention
3. Add the image reference to `README.md` with a `?v=1` cache param
4. Run the script, verify the output, commit both the image and README changes

## Troubleshooting

| Problem | Fix |
|---|---|
| `EPERM` / `.next/trace` error | Kill node, delete `.next`, restart dev server |
| `networkidle` timeout | Use `domcontentloaded` instead — TradingView/external widgets prevent idle |
| Blank screenshots | Increase `extraWait` — page may not have rendered yet |
| Old images on GitHub | Add/increment `?v=N` on image URLs in README.md |
| Edit button not clickable | Use `page.evaluate()` JS click — button is `opacity-0` until hover |
