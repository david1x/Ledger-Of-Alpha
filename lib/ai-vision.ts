// Server-side only — OpenAI GPT-4o chart pattern analysis wrapper
import OpenAI from "openai";
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

// ── JSON schema for structured output ─────────────────────────────────────

export const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    patterns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", enum: [...PATTERN_NAMES] },
          confidence: { type: "number" },
          description: { type: "string" },
        },
        required: ["name", "confidence", "description"],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: 3,
    },
    primary_pattern: { type: "string", enum: [...PATTERN_NAMES] },
    summary: { type: "string" },
  },
  required: ["patterns", "primary_pattern", "summary"],
  additionalProperties: false,
} as const;

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

// ── Exported functions ─────────────────────────────────────────────────────

/**
 * Analyze a chart screenshot with GPT-4o and return structured pattern results.
 */
export async function analyzeChartScreenshot(
  apiKey: string,
  filename: string
): Promise<AnalysisResult> {
  const client = new OpenAI({ apiKey });
  const { base64, mime } = await toBase64(filename);

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are an expert technical analyst. Analyze this trading chart screenshot and identify the top price action patterns present. For each pattern you detect, assign a confidence score from 0.0 to 1.0. Only return patterns with confidence >= 0.3. If you cannot identify any pattern with confidence >= 0.3, return a single entry with name "None Detected" and confidence 0.0. Return at most 3 patterns, sorted by confidence descending. The primary_pattern field must match patterns[0].name exactly.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mime};base64,${base64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "chart_analysis",
        strict: true,
        schema: ANALYSIS_SCHEMA as Record<string, unknown>,
      },
    },
    max_tokens: 800,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("Empty response from OpenAI");
  return JSON.parse(content) as AnalysisResult;
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
  const client = new OpenAI({ apiKey });
  const { base64, mime } = await toBase64(filename);

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "assistant",
        content: `I analyzed this chart and detected: ${priorAnalysis.summary}. Primary pattern: ${priorAnalysis.primary_pattern}.`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: question },
          {
            type: "image_url",
            image_url: {
              url: `data:${mime};base64,${base64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    max_tokens: 500,
  });

  return response.choices[0].message.content ?? "";
}
