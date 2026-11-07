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
  /** Law reader (scripts/extract-laws.ts). Do not change. */
  extraction: "openai/gpt-oss-120b",
  /**
   * Product reader (live, /api/product-reader): needs strict json_schema.
   * gpt-oss-20b is a production model with strict mode and its own daily
   * token budget, separate from gpt-oss-120b (Groq docs, 7 Nov 2026).
   */
  productReader: "openai/gpt-oss-20b",
  /**
   * Notice drafter (live, /api/draft-notice): plain text streaming.
   * qwen/qwen3.8-27b supports reasoning_effort "none", so tokens stream
   * immediately with no hidden reasoning phase. It is a PREVIEW model on
   * Groq (may be discontinued at short notice); if it disappears, switch
   * to "openai/gpt-oss-20b" (drop reasoning_effort "none", use "low").
   * llama-3.3-70b-versatile is now enterprise-only on Groq.
   */
  drafter: "qwen/qwen3.8-27b",
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
    /** For rate limits: how long Groq asked us to wait. */
    readonly retryAfterMs?: number,
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
  /** Override GROQ_CONFIG.maxRetries (interactive calls use 1). */
  maxRetries?: number;
  /**
   * Longest single wait allowed (rate limits, backoff). If Groq asks for a
   * longer wait, fail at once with a "rate-limit" error instead. Default:
   * no limit (batch jobs wait).
   */
  maxWaitMs?: number;
  /** Per-request timeout override. */
  timeoutMs?: number;
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
 * Turn a non-OK Groq response into a GroqError, and say whether it is
 * worth retrying (and after how long).
 */
async function classifyFailure(
  res: Response,
  maxCompletionTokens: number,
  attempt: number,
): Promise<{ error: GroqError; retry: boolean; waitMs: number }> {
  const text = await res.text();
  const detail = errorMessageFrom(text);
  const backoff = Math.min(30_000, 2000 * 2 ** attempt);
  const fatal = (error: GroqError) => ({ error, retry: false, waitMs: 0 });

  if (res.status === 401 || res.status === 403) {
    return fatal(new GroqError("auth", `Groq rejected the API key (HTTP ${res.status}): ${detail}`, res.status));
  }
  if (res.status === 413) {
    return fatal(
      new GroqError(
        "request-too-large",
        `Request too large for this Groq model/tier (HTTP 413): ${detail}. Reduce the input size.`,
        res.status,
      ),
    );
  }
  if (res.status === 429) {
    const waitMs =
      parseDuration(res.headers.get("retry-after")) ??
      parseDuration(res.headers.get("x-ratelimit-reset-tokens")) ??
      Math.min(60_000, 5000 * 2 ** attempt);
    if (/per day|TPD|RPD/i.test(detail) && waitMs > 5 * 60_000) {
      return fatal(new GroqError("rate-limit", `Groq daily limit reached: ${detail}`, 429, waitMs));
    }
    return {
      error: new GroqError("rate-limit", `Groq rate limit (HTTP 429): ${detail}`, 429, waitMs),
      retry: true,
      waitMs: waitMs + 250,
    };
  }
  if (res.status >= 500) {
    return {
      error: new GroqError("server", `Groq server error (HTTP ${res.status}): ${detail}`, res.status),
      retry: true,
      waitMs: backoff,
    };
  }
  if (res.status === 400 && /max completion tokens reached|truncated to fit max_completion_tokens/i.test(text)) {
    return fatal(
      new GroqError(
        "truncated",
        `Groq reply was cut off at max_completion_tokens=${maxCompletionTokens} before the JSON was complete. Use a smaller input or a higher limit.`,
        400,
      ),
    );
  }
  if (res.status === 400 && /json_validate_failed|failed to generate/i.test(text)) {
    return {
      error: new GroqError("invalid-output", `Groq could not produce schema-valid JSON: ${detail}`, 400),
      retry: true,
      waitMs: 0,
    };
  }
  return fatal(new GroqError("bad-request", `Groq request failed (HTTP ${res.status}): ${detail}`, res.status));
}

/** Wait before a retry, or throw at once if the wait is longer than allowed. */
async function waitOrThrow(
  error: GroqError,
  waitMs: number,
  maxWaitMs: number | undefined,
  onWait?: (m: string) => void,
) {
  if (maxWaitMs !== undefined && waitMs > maxWaitMs) {
    throw new GroqError(error.kind, error.message, error.status, waitMs);
  }
  if (waitMs > 0) {
    if (error.kind === "rate-limit") onWait?.(`Rate limited by Groq; waiting ${(waitMs / 1000).toFixed(1)}s`);
    await sleep(waitMs);
  }
}

function fetchFailure(err: unknown, timeoutMs: number): GroqError {
  const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
  return isTimeout
    ? new GroqError("timeout", `Groq request timed out after ${timeoutMs / 1000}s`)
    : new GroqError("network", `Could not reach Groq: ${err instanceof Error ? err.message : String(err)}`);
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
  const maxRetries = req.maxRetries ?? GROQ_CONFIG.maxRetries;
  const timeoutMs = req.timeoutMs ?? GROQ_CONFIG.timeoutMs;

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

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0 && lastError) {
      req.onWait?.(`Retry ${attempt}/${maxRetries} after: ${lastError.message}`);
    }
    // Batch jobs pace themselves on the token budget; interactive calls don't wait.
    if (req.maxWaitMs === undefined) await waitForBudget(needed, req.onWait);

    let res: Response;
    try {
      res = await fetch(`${GROQ_CONFIG.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      lastError = fetchFailure(err, timeoutMs);
      if (attempt < maxRetries) {
        await waitOrThrow(lastError, Math.min(30_000, 2000 * 2 ** attempt), req.maxWaitMs, req.onWait);
      }
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

    const failure = await classifyFailure(res, maxCompletionTokens, attempt);
    lastError = failure.error;
    if (!failure.retry) throw failure.error;
    if (attempt < maxRetries) await waitOrThrow(failure.error, failure.waitMs, req.maxWaitMs, req.onWait);
  }

  throw lastError ?? new GroqError("server", "Groq request failed after retries");
}

export interface StreamRequest {
  system: string;
  user: string;
  model: GroqModel;
  maxCompletionTokens?: number;
  temperature?: number;
  /** Sent as reasoning_effort when set (e.g. "none" for qwen3 models). */
  reasoningEffort?: "none" | "low" | "medium" | "high";
  /** Abort the Groq request (e.g. when the browser stops reading). */
  signal?: AbortSignal;
  /** Longest wait allowed on a rate limit before failing. Default 10s. */
  maxWaitMs?: number;
}

/**
 * Stream a plain-text chat completion from Groq (OpenAI-style SSE).
 * Yields content deltas as they arrive. Errors before the first token
 * throw GroqError; one short retry is made for rate limits / 5xx.
 * Returns quietly when `signal` is aborted.
 */
export async function* groqStream(req: StreamRequest): AsyncGenerator<string, void, undefined> {
  const key = apiKey();
  const maxCompletionTokens = req.maxCompletionTokens ?? 2048;
  const maxWaitMs = req.maxWaitMs ?? 10_000;
  const body = JSON.stringify({
    model: req.model,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    stream: true,
    temperature: req.temperature ?? 0.3,
    max_completion_tokens: maxCompletionTokens,
    ...(req.reasoningEffort ? { reasoning_effort: req.reasoningEffort } : {}),
  });

  const timeout = AbortSignal.timeout(GROQ_CONFIG.timeoutMs);
  const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;

  let res: Response | null = null;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      res = await fetch(`${GROQ_CONFIG.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body,
        signal,
      });
    } catch (err) {
      if (req.signal?.aborted) return;
      throw fetchFailure(err, GROQ_CONFIG.timeoutMs);
    }
    recordRateHeaders(res.headers);
    if (res.ok) break;
    const failure = await classifyFailure(res, maxCompletionTokens, attempt);
    if (!failure.retry || attempt === 1) throw failure.error;
    await waitOrThrow(failure.error, failure.waitMs, maxWaitMs);
    res = null;
  }
  if (!res?.body) throw new GroqError("server", "Groq returned no stream body");

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        let event: {
          choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
          error?: { message?: string };
        };
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }
        if (event.error) throw new GroqError("server", `Groq stream error: ${event.error.message ?? "unknown"}`);
        const delta = event.choices?.[0]?.delta?.content;
        if (delta) yield delta;
        if (event.choices?.[0]?.finish_reason === "length") {
          throw new GroqError("truncated", `Draft was cut off at ${maxCompletionTokens} tokens`);
        }
      }
    }
  } catch (err) {
    if (req.signal?.aborted) return;
    if (err instanceof GroqError) throw err;
    throw fetchFailure(err, GROQ_CONFIG.timeoutMs);
  } finally {
    reader.cancel().catch(() => {});
  }
}
