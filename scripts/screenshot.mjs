/**
 * Takes screenshots of all pages using guest/demo mode.
 * Run with: node scripts/screenshot.mjs
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
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
  // Use load instead of networkidle — pages with live quotes never go fully idle
  await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 30000 });

  if (waitFor) {
    try { await page.waitForSelector(waitFor, { timeout: 20000 }); } catch {
      console.log(`⚠ Warning: timeout waiting for ${waitFor} on ${url}`);
    }
  }
  // Settle delay for animations / chart renders
  await page.waitForTimeout(2000);

  if (beforeShot) {
    try { await beforeShot(page); } catch (e) { console.log(`⚠ beforeShot error on ${name}:`, e.message); }
  }

  await page.waitForTimeout(1000);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${name}.png (${(fs.statSync(file).size / 1024).toFixed(1)} KB)`);
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
    beforeShot: async (p) => {
      // Mini charts are open by default — scroll down slightly to show a card with chart
      await p.waitForTimeout(800);
      await p.evaluate(() => window.scrollBy(0, 100));
      await p.waitForTimeout(600);
    },
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

  // Strategies tab in settings
  await shot(page, "12-settings-strategies", "/settings?tab=strategies", {
    waitFor: "button[class*='emerald']", // Add Strategy button
    beforeShot: async (p) => {
      await p.waitForTimeout(800);
    },
  });

  // Login page (no auth needed)
  await shot(page, "06-login", "/login", {
    waitFor: "form",
  });

  // Alert Modal (newly redesigned)
  await shot(page, "13-alert-modal", "/chart", {
    beforeShot: async (p) => {
      await p.waitForTimeout(2000);
      // Click the Alert button in the chart toolbar
      await p.evaluate(() => {
        const btns = [...document.querySelectorAll("button")];
        const alertBtn = btns.find(b => b.textContent?.includes("Alert"));
        if (alertBtn) alertBtn.click();
      });
      await p.waitForTimeout(1500);
    },
    height: 900,
  });

  // Trades page with trade modal open
  await shot(page, "07-trade-modal", "/trades", {
    waitFor: "table",
    beforeShot: async (p) => {
      // Wait for table rows with data to appear
      await p.waitForSelector("tbody tr td", { timeout: 10000 });
      await p.waitForTimeout(500);
      // The edit button has opacity-0 until hover — use JS click to bypass
      await p.evaluate(() => {
        const btn = document.querySelector("button[title='Edit']");
        if (btn) btn.click();
      });
      // Wait for modal to fully animate in
      await p.waitForTimeout(2000);
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
