// Server-side only — Gemini chart pattern analysis wrapper
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFile } from "fs/promises";
import path from "path";

const SCREENSHOTS_DIR = path.join(process.cwd(), "data", "screenshots");

// ── Exported interfaces ────────────────────────────────────────────────────

export interface PatternResult {
  name: string;       // e.g. "Bull Flag"
  confidence: number; // 0.0 – 1.0
  description: string; // 1-2 sentence explanation
}

export interface AnalysisResult {
  patterns: PatternResult[]; // top 2-3, sorted by confidence desc
  primary_pattern: string;   // patterns[0].name
  summary: string;           // overall chart context sentence
}

export interface QAEntry {
  question: string;
  answer: string;
  ts: string;              // ISO timestamp
  screenshotFilename: string;
}

// ── Pattern catalogue ──────────────────────────────────────────────────────

export const PATTERN_NAMES = [
  "Head & Shoulders",
  "Inverse Head & Shoulders",
  "Bull Flag",
  "Bear Flag",
  "Ascending Triangle",
  "Descending Triangle",
  "Rising Wedge",
  "Falling Wedge",
  "Double Top",
  "Double Bottom",
  "Cup & Handle",
  "Channel Up",
  "Channel Down",
  "Sideways Channel",
  "None Detected",
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase().slice(1);
  if (ext === "webp") return "image/webp";
  if (ext === "png") return "image/png";
  return "image/jpeg";
}

async function toBase64(filename: string): Promise<{ base64: string; mime: string }> {
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  const buffer = await readFile(filepath);
  return {
    base64: buffer.toString("base64"),
    mime: getMimeType(filename),
  };
}

const ANALYSIS_PROMPT = `You are an expert technical analyst. Analyze this trading chart screenshot and identify the top price action patterns present. For each pattern you detect, assign a confidence score from 0.0 to 1.0. Only return patterns with confidence >= 0.3. If you cannot identify any pattern with confidence >= 0.3, return a single entry with name "None Detected" and confidence 0.0. Return at most 3 patterns, sorted by confidence descending. The primary_pattern field must match patterns[0].name exactly.

Pattern names must be one of: ${PATTERN_NAMES.join(", ")}

Respond with ONLY valid JSON in this exact format:
{
  "patterns": [
    { "name": "Pattern Name", "confidence": 0.85, "description": "Brief explanation" }
  ],
  "primary_pattern": "Pattern Name",
  "summary": "One sentence overall chart context"
}`;

// ── Exported functions ─────────────────────────────────────────────────────

/**
 * Analyze a chart screenshot with Gemini and return structured pattern results.
 */
export async function analyzeChartScreenshot(
  apiKey: string,
  filename: string
): Promise<AnalysisResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const { base64, mime } = await toBase64(filename);

  const result = await model.generateContent([
    ANALYSIS_PROMPT,
    {
      inlineData: {
        mimeType: mime,
        data: base64,
      },
    },
  ]);

  const text = result.response.text();
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  if (!cleaned) throw new Error("Empty response from Gemini");
  return JSON.parse(cleaned) as AnalysisResult;
}

/**
 * Ask a follow-up question about a chart, given a prior analysis context.
 * Returns a free-text answer string.
 */
export async function askFollowUp(
  apiKey: string,
  filename: string,
  question: string,
  priorAnalysis: AnalysisResult
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const { base64, mime } = await toBase64(filename);

  const context = `I previously analyzed this chart and detected: ${priorAnalysis.summary}. Primary pattern: ${priorAnalysis.primary_pattern}.`;

  const result = await model.generateContent([
    `${context}\n\nThe user asks: ${question}\n\nProvide a concise, helpful answer about the chart.`,
    {
      inlineData: {
        mimeType: mime,
        data: base64,
      },
    },
  ]);

  return result.response.text() ?? "";
}
