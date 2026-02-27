/**
 * Takes screenshots of all pages using guest/demo mode.
 * Run with: node scripts/screenshot.mjs
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../docs/screenshots");
const BASE = "http://localhost:3000";

// Set guest cookie so all API calls return demo data
const GUEST_COOKIE = {
  name: "guest",
  value: "true",
  domain: "localhost",
  path: "/",
  httpOnly: false,
  secure: false,
  sameSite: "Lax",
};

async function shot(page, name, url, { waitFor, beforeShot, width = 1280, height = 800, mobile = false } = {}) {
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });

  if (waitFor) {
    try { await page.waitForSelector(waitFor, { timeout: 6000 }); } catch {}
  }
  // Small settle delay for animations / chart renders
  await page.waitForTimeout(1200);

  if (beforeShot) {
    try { await beforeShot(page); } catch { /* non-fatal */ }
  }

  await page.waitForTimeout(400);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${name}.png`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addCookies([GUEST_COOKIE]);
  const page = await ctx.newPage();

  // Force dark mode via script
  await ctx.addInitScript(() => {
    localStorage.setItem("theme", "dark");
  });

  // ── Desktop screenshots ───────────────────────────────────────────────
  console.log("\n── Desktop (1280×800) ──");

  await shot(page, "01-dashboard", "/", {
    waitFor: ".recharts-responsive-container",
  });

  await shot(page, "02-trades", "/trades", {
    waitFor: "table",
  });

  await shot(page, "03-journal", "/journal", {
    waitFor: "[class*='grid']",
  });

  // Chart page — wait for toolbar, then open Add Trade panel
  await shot(page, "04-chart", "/chart", {
    waitFor: "[title='Collapse panel'], button[class*='emerald']",
    beforeShot: async (p) => {
      // Open Add Trade panel if it's collapsed
      const toggle = await p.$("button[title='Add Trade']");
      if (toggle) await toggle.click();
      await p.waitForTimeout(600);
    },
    height: 900,
  });

  await shot(page, "05-settings", "/settings", {
    waitFor: "section",
  });

  // Login page (no auth needed)
  await shot(page, "06-login", "/login", {
    waitFor: "form",
  });

  // Trades page with trade modal open
  await shot(page, "07-trade-modal", "/trades", {
    waitFor: "table",
    beforeShot: async (p) => {
      // Wait for table rows to appear, then click first edit button
      await p.waitForSelector("tbody tr", { timeout: 5000 });
      await p.waitForTimeout(300);
      const editBtn = p.locator("button[title='Edit']").first();
      await editBtn.click({ timeout: 5000 });
      await p.waitForTimeout(1000);
    },
    height: 900,
  });

  // ── Mobile screenshots (iPhone 14 — 390×844) ──────────────────────────
  console.log("\n── Mobile (390×844) ──");

  await shot(page, "08-mobile-dashboard", "/", {
    waitFor: "[class*='grid']",
    width: 390,
    height: 844,
  });

  await shot(page, "09-mobile-trades", "/trades", {
    waitFor: "[class*='divide-y']",
    width: 390,
    height: 844,
  });

  await shot(page, "10-mobile-chart", "/chart", {
    waitFor: "button",
    width: 390,
    height: 844,
    beforeShot: async (p) => {
      // Open Add Trade panel on mobile via the FAB
      await p.waitForTimeout(1500);
      const fab = p.locator("button.rounded-full").first();
      await fab.click({ timeout: 5000 });
      await p.waitForTimeout(800);
    },
  });

  // Mobile settings
  await shot(page, "11-mobile-settings", "/settings", {
    waitFor: "section",
    width: 390,
    height: 844,
  });

  await browser.close();
  console.log(`\nAll screenshots saved to docs/screenshots/`);
})();
