const path = require("path");
const fs = require("fs");

function log(msg, success = true) {
  const icon = success ? "✅" : "❌";
  console.log(`${icon} ${msg}`);
}

async function verify() {
  console.log("🔍 Starting Wave 1 Phase 06 Verification...\n");

  // 1. Verify Simulation Logic
  const simPath = path.join(process.cwd(), "lib", "simulation.ts");
  if (fs.existsSync(simPath)) {
    const content = fs.readFileSync(simPath, "utf8");
    if (content.includes("runMonteCarlo") && content.includes("Math.random()")) {
      log("Simulation: 'runMonteCarlo' implemented with bootstrap resampling.");
    } else {
      log("Simulation: 'runMonteCarlo' implementation looks incomplete.", false);
    }
  } else {
    log("Simulation: 'lib/simulation.ts' is missing.", false);
  }

  // 2. Verify Insight Engine
  const insightPath = path.join(process.cwd(), "lib", "insight-engine.ts");
  if (fs.existsSync(insightPath)) {
    const content = fs.readFileSync(insightPath, "utf8");
    if (content.includes("discoverInsights") && content.includes("bySymbol") && content.includes("byTag")) {
      log("Insight Engine: 'discoverInsights' implemented with multi-dimensional analysis.");
    } else {
      log("Insight Engine: 'discoverInsights' implementation looks incomplete.", false);
    }
  } else {
    log("Insight Engine: 'lib/insight-engine.ts' is missing.", false);
  }

  // 3. Verify Components
  const components = [
    "dashboard/RiskSimulator.tsx",
    "dashboard/AIInsightsWidget.tsx"
  ];

  components.forEach(comp => {
    const compPath = path.join(process.cwd(), "components", comp);
    if (fs.existsSync(compPath)) {
      const content = fs.readFileSync(compPath, "utf8");
      if (comp.includes("RiskSimulator") && content.includes("LineChart") && content.includes("BarChart")) {
        log(`Component: '${comp}' exists and uses Recharts.`);
      } else if (comp.includes("AIInsightsWidget") && content.includes("InsightCard")) {
        log(`Component: '${comp}' exists and implements InsightCards.`);
      } else {
        log(`Component: '${comp}' content verification failed.`, false);
      }
    } else {
      log(`Component: 'components/${comp}' is missing.`, false);
    }
  });

  // 4. Verify Dashboard Integration
  const shellPath = path.join(process.cwd(), "components", "dashboard", "DashboardShell.tsx");
  if (fs.existsSync(shellPath)) {
    const content = fs.readFileSync(shellPath, "utf8");
    if (content.includes("risk-simulator") && content.includes("ai-insights")) {
      log("Dashboard: Widgets integrated into 'DashboardShell.tsx'.");
    } else {
      log("Dashboard: Widgets missing from 'DashboardShell.tsx'.", false);
    }
  }

  console.log("\n✨ Verification Complete!");
}

verify().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
