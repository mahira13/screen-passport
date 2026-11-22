// Cost estimates for Claude calls, from token usage and list prices. Estimates only: the pipeline
// log labels them as such. Pure.

export type Price = { inPerM: number; outPerM: number };

// Anthropic list prices per million tokens (first-party API).
const PRICES: Record<string, Price> = {
  "claude-fable-5-2": { inPerM: 8, outPerM: 40 },
  "claude-fable-5-1": { inPerM: 10, outPerM: 50 },
  "claude-fable-5": { inPerM: 10, outPerM: 50 },
  "claude-opus-5-5": { inPerM: 4, outPerM: 20 },
  "claude-opus-5": { inPerM: 5, outPerM: 25 },
  "claude-opus-4-8": { inPerM: 5, outPerM: 25 },
  "claude-opus-4-7": { inPerM: 5, outPerM: 25 },
  "claude-opus-4-6": { inPerM: 5, outPerM: 25 },
  "claude-sonnet-5-5": { inPerM: 2, outPerM: 10 },
  "claude-sonnet-5": { inPerM: 2, outPerM: 10 },
  "claude-sonnet-4-6": { inPerM: 3, outPerM: 15 },
  "claude-haiku-5-5": { inPerM: 0.1, outPerM: 0.5 },
  "claude-haiku-4-5": { inPerM: 1, outPerM: 5 },
};
// Unknown model: assume an expensive one, so the budget stops early rather than late.
const FALLBACK: Price = { inPerM: 10, outPerM: 50 };
const WEB_SEARCH_USD = 0.01; // per search

type Env = Record<string, string | undefined>;
const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null);

/** AI_PRICE_INPUT_PER_MTOK / AI_PRICE_OUTPUT_PER_MTOK override the table (e.g. for a new model). */
export function priceFor(model: string, env: Env = process.env): Price {
  const base = PRICES[model] ?? FALLBACK;
  return { inPerM: num(env.AI_PRICE_INPUT_PER_MTOK) ?? base.inPerM, outPerM: num(env.AI_PRICE_OUTPUT_PER_MTOK) ?? base.outPerM };
}

export const webSearchPrice = (env: Env = process.env) => num(env.AI_WEB_SEARCH_PRICE) ?? WEB_SEARCH_USD;

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

/** What a response cost: cache writes at 1.25×, cache reads at 0.1× the input price. */
export function costOf(u: Usage, p: Price, searchUsd = WEB_SEARCH_USD): number {
  const input = u.input_tokens + 1.25 * (u.cache_creation_input_tokens ?? 0) + 0.1 * (u.cache_read_input_tokens ?? 0);
  const usd = (input * p.inPerM + u.output_tokens * p.outPerM) / 1e6 + (u.server_tool_use?.web_search_requests ?? 0) * searchUsd;
  return Math.round(usd * 1e6) / 1e6;
}

/**
 * Upper bound reserved before a call: about 4 characters per token for the prompt, the full
 * max_tokens, and every allowed search with its results (about 20k input tokens each).
 */
export function estimateCost(promptChars: number, maxTokens: number, p: Price, maxSearches = 0, searchUsd = WEB_SEARCH_USD): number {
  const input = promptChars / 4 + maxSearches * 20_000;
  return Math.round(((input * p.inPerM + maxTokens * p.outPerM) / 1e6 + maxSearches * searchUsd) * 1e6) / 1e6;
}

/** DAILY_AI_BUDGET in US dollars; null when unset or invalid (then the pipeline makes no AI calls). */
export const dailyBudget = (env: Env = process.env) => num(env.DAILY_AI_BUDGET);
