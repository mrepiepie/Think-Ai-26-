import "server-only";

import { z } from "zod";

/**
 * Shared Groq client (server-only). Uses Groq's OpenAI-compatible
 * Chat Completions API with Structured Outputs (JSON Schema, strict mode).
 *
 * The API key comes from GROQ_API_KEY. It is never logged or returned.
 */

/**
 * All Groq model names live here.
 *
 * Per Groq's Structured Outputs docs (checked 7 Nov 2026), strict
 * `json_schema` mode (constrained decoding) is supported on
 * openai/gpt-oss-20b, openai/gpt-oss-120b, qwen/qwen3.8-27b and
 * meta-models/muse-spark-open. gpt-oss-120b is the strongest of these
 * for careful legal-text extraction (131k context, reasoning model).
 */
export const GROQ_MODELS = {
  extraction: "openai/gpt-oss-120b",
} as const;

export type GroqModel = (typeof GROQ_MODELS)[keyof typeof GROQ_MODELS];

export const GROQ_CONFIG = {
  baseUrl: "https://api.groq.com/openai/v1",
  /** Per-request timeout. Reasoning models can take a while on long chunks. */
  timeoutMs: 180_000,
  /** Retries for rate limits, timeouts, network and 5xx errors. */
  maxRetries: 5,
} as const;

export type GroqErrorKind =
  | "missing-key"
  | "auth"
  | "rate-limit"
  | "request-too-large"
  | "timeout"
  | "network"
  | "bad-request"
  | "server"
  | "truncated"
  | "invalid-output";

export class GroqError extends Error {
  constructor(
    readonly kind: GroqErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GroqError";
  }
}

export interface GroqUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StructuredRequest<T> {
  /** zod schema the reply must match; also sent to Groq as JSON Schema. */
  schema: z.ZodType<T>;
  /** Short identifier for the schema (letters, digits, _ or -). */
  schemaName: string;
  system: string;
  user: string;
  model?: GroqModel;
  /** Upper bound on output tokens (reasoning + answer). */
  maxCompletionTokens?: number;
  reasoningEffort?: "low" | "medium" | "high";
  temperature?: number;
  /** Called with a human-readable line when the client waits or retries. */
  onWait?: (message: string) => void;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  usage: GroqUsage;
}

function apiKey(): string {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) {
    throw new GroqError(
      "missing-key",
      "GROQ_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  return key;
}

/** Parse Groq/OpenAI-style durations such as "7.66s", "2m59.56s", "120ms". */
export function parseDuration(value: string | null): number | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v) * 1000;
  let ms = 0;
  let matched = false;
  for (const [, num, unit] of v.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) {
    matched = true;
    const n = Number(num);
    ms += unit === "h" ? n * 3_600_000 : unit === "m" ? n * 60_000 : unit === "s" ? n * 1000 : n;
  }
  return matched ? ms : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Token-per-minute pacing from the x-ratelimit-* headers Groq sends on
 * every response, so long batch jobs wait instead of hitting 429s.
 */
const pacing = { remainingTokens: Infinity, resetAt: 0 };

async function waitForBudget(neededTokens: number, onWait?: (m: string) => void) {
  const now = Date.now();
  if (pacing.remainingTokens >= neededTokens || now >= pacing.resetAt) return;
  const waitMs = pacing.resetAt - now + 250;
  onWait?.(
    `Groq token budget low (${pacing.remainingTokens} left, ~${neededTokens} needed); waiting ${(waitMs / 1000).toFixed(1)}s`,
  );
  await sleep(waitMs);
}

function recordRateHeaders(headers: Headers) {
  const remaining = Number(headers.get("x-ratelimit-remaining-tokens"));
  const reset = parseDuration(headers.get("x-ratelimit-reset-tokens"));
  if (Number.isFinite(remaining)) pacing.remainingTokens = remaining;
  if (reset !== null) pacing.resetAt = Date.now() + reset;
}

/** Rough token estimate (about 4 characters per token for English). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function errorMessageFrom(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; code?: string } };
    const e = parsed.error;
    if (e?.message) return e.code ? `${e.message} (${e.code})` : e.message;
  } catch {
    /* not JSON */
  }
  return body.slice(0, 300);
}

/**
 * Call Groq with a strict JSON Schema and validate the reply with zod.
 * Retries rate limits (honouring retry-after), timeouts, network errors
 * and 5xx responses. Throws GroqError with a clear message otherwise.
 */
export async function groqStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
  const key = apiKey();
  const model = req.model ?? GROQ_MODELS.extraction;
  const maxCompletionTokens = req.maxCompletionTokens ?? 4096;

  const jsonSchema = z.toJSONSchema(req.schema, { target: "draft-7" }) as Record<string, unknown>;
  delete jsonSchema.$schema;

  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: req.schemaName, strict: true, schema: jsonSchema },
    },
    temperature: req.temperature ?? 0,
    max_completion_tokens: maxCompletionTokens,
    ...(req.reasoningEffort ? { reasoning_effort: req.reasoningEffort } : {}),
    include_reasoning: false,
  });

  const needed = estimateTokens(req.system + req.user) + maxCompletionTokens;
  let lastError: GroqError | null = null;

  for (let attempt = 0; attempt <= GROQ_CONFIG.maxRetries; attempt++) {
    if (attempt > 0 && lastError) {
      req.onWait?.(`Retry ${attempt}/${GROQ_CONFIG.maxRetries} after: ${lastError.message}`);
    }
    await waitForBudget(needed, req.onWait);

    let res: Response;
    try {
      res = await fetch(`${GROQ_CONFIG.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(GROQ_CONFIG.timeoutMs),
      });
    } catch (err) {
      const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      lastError = isTimeout
        ? new GroqError("timeout", `Groq request timed out after ${GROQ_CONFIG.timeoutMs / 1000}s`)
        : new GroqError("network", `Could not reach Groq: ${err instanceof Error ? err.message : String(err)}`);
      await sleep(Math.min(30_000, 2000 * 2 ** attempt));
      continue;
    }

    recordRateHeaders(res.headers);

    if (res.ok) {
      const json = (await res.json()) as {
        model: string;
        choices: { finish_reason: string; message: { content: string | null } }[];
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };
      const choice = json.choices[0];
      if (choice?.finish_reason === "length") {
        throw new GroqError(
          "truncated",
          `Groq reply was cut off at max_completion_tokens=${maxCompletionTokens}. Use smaller chunks or a higher limit.`,
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(choice?.message.content ?? "");
      } catch {
        lastError = new GroqError("invalid-output", "Groq returned text that is not valid JSON");
        continue;
      }
      const checked = req.schema.safeParse(parsed);
      if (!checked.success) {
        lastError = new GroqError(
          "invalid-output",
          `Groq JSON did not match the schema: ${checked.error.issues[0]?.message ?? "unknown issue"}`,
        );
        continue;
      }
      return {
        data: checked.data,
        model: json.model,
        usage: {
          promptTokens: json.usage?.prompt_tokens ?? 0,
          completionTokens: json.usage?.completion_tokens ?? 0,
          totalTokens: json.usage?.total_tokens ?? 0,
        },
      };
    }

    const text = await res.text();
    const detail = errorMessageFrom(text);

    if (res.status === 401 || res.status === 403) {
      throw new GroqError("auth", `Groq rejected the API key (HTTP ${res.status}): ${detail}`, res.status);
    }
    if (res.status === 413) {
      throw new GroqError(
        "request-too-large",
        `Request too large for this Groq model/tier (HTTP 413): ${detail}. Reduce the chunk size.`,
        res.status,
      );
    }
    if (res.status === 429) {
      const waitMs =
        parseDuration(res.headers.get("retry-after")) ??
        parseDuration(res.headers.get("x-ratelimit-reset-tokens")) ??
        Math.min(60_000, 5000 * 2 ** attempt);
      lastError = new GroqError("rate-limit", `Groq rate limit (HTTP 429): ${detail}`, 429);
      if (/per day|TPD|RPD/i.test(detail) && waitMs > 5 * 60_000) {
        throw new GroqError("rate-limit", `Groq daily limit reached: ${detail}`, 429);
      }
      req.onWait?.(`Rate limited by Groq; waiting ${(waitMs / 1000).toFixed(1)}s`);
      await sleep(waitMs + 250);
      continue;
    }
    if (res.status >= 500) {
      lastError = new GroqError("server", `Groq server error (HTTP ${res.status}): ${detail}`, res.status);
      await sleep(Math.min(30_000, 2000 * 2 ** attempt));
      continue;
    }
    if (res.status === 400 && /max completion tokens reached|truncated to fit max_completion_tokens/i.test(text)) {
      throw new GroqError(
        "truncated",
        `Groq reply was cut off at max_completion_tokens=${maxCompletionTokens} before the JSON was complete. Use a smaller input or a higher limit.`,
        400,
      );
    }
    if (res.status === 400 && /json_validate_failed|failed to generate/i.test(text)) {
      lastError = new GroqError("invalid-output", `Groq could not produce schema-valid JSON: ${detail}`, 400);
      continue;
    }
    throw new GroqError("bad-request", `Groq request failed (HTTP ${res.status}): ${detail}`, res.status);
  }

  throw lastError ?? new GroqError("server", "Groq request failed after retries");
}
