// Every pipeline Claude call goes through guardedCreate: it reserves an upper-bound cost against
// DAILY_AI_BUDGET (atomically, in Postgres) before the call and settles the real cost after.
// When the budget is spent, or unset, it throws BudgetExhausted and the job waits for tomorrow.
// Server only.
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../supabase";
import { costOf, dailyBudget, estimateCost, priceFor, webSearchPrice } from "./cost";

export class BudgetExhausted extends Error {}

/** Calls and estimated cost since the last reset; the worker writes them to pipeline_runs. */
export const aiTally = { calls: 0, cost: 0 };
export const resetAiTally = () => Object.assign(aiTally, { calls: 0, cost: 0 });

export function aiModel(): string {
  const model = process.env.ANTHROPIC_MODEL;
  if (!process.env.ANTHROPIC_API_KEY || !model) throw new Error("Set ANTHROPIC_API_KEY and ANTHROPIC_MODEL");
  return model;
}

// An image costs at most a few thousand tokens however many bytes it has; counting its base64 text would reserve dollars.
const IMAGE_CHARS = 4 * 5_000;
const promptLength = (messages: Anthropic.MessageParam[]) =>
  JSON.stringify(messages, (k, v) => (k === "data" && typeof v === "string" ? "" : v)).length +
  JSON.stringify(messages).split('"type":"image"').length * IMAGE_CHARS - IMAGE_CHARS;

export async function guardedCreate(params: Anthropic.MessageCreateParamsNonStreaming, maxSearches = 0): Promise<Anthropic.Message> {
  const budget = dailyBudget();
  if (budget === null) throw new BudgetExhausted("DAILY_AI_BUDGET is not set, so no AI calls are made.");
  const price = priceFor(params.model);
  const promptChars = promptLength(params.messages) + JSON.stringify(params.system ?? "").length;
  const estimate = estimateCost(promptChars, params.max_tokens, price, maxSearches, webSearchPrice());
  const db = supabaseAdmin();
  const { data: ok, error } = await db.rpc("ai_reserve", { p_estimate: estimate, p_budget: budget });
  if (error) throw new Error(`AI budget: ${error.message} (is migration 014 applied?)`);
  if (!ok) throw new BudgetExhausted(`Daily AI budget of $${budget} reached.`);
  let actual = 0;
  try {
    const res = await new Anthropic({ timeout: 120_000, maxRetries: 1 }).messages.create(params);
    actual = costOf(res.usage, price, webSearchPrice());
    return res;
  } finally {
    aiTally.calls++;
    aiTally.cost += actual;
    const { error: settleErr } = await db.rpc("ai_settle", { p_estimate: estimate, p_actual: actual });
    if (settleErr) console.error("AI budget settle failed:", settleErr.message);
  }
}
