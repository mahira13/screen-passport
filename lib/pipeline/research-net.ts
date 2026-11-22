// Runs the research call: Claude with web search limited to the trusted domains. Server only.
import Anthropic from "@anthropic-ai/sdk";
import { aiModel, guardedCreate } from "./ai";
import { domainGroups, type Lead, parseResearch, RESEARCH_SYSTEM, researchPrompt } from "./research";

const MAX_SEARCHES = 3; // per domain group: keeps one call inside a request's time window
const ENOUGH = 8;

type ResearchWork = { title: string; type: "film" | "series"; year: number | null; aliases: string[] };

async function ask(work: ResearchWork, domains: string[], toolType: "web_search_20260209" | "web_search_20250305"): Promise<Lead[]> {
  const model = aiModel();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: researchPrompt(work) }];
  for (let turn = 0; turn < 3; turn++) {
    const res = await guardedCreate({
      model,
      max_tokens: 4000,
      system: RESEARCH_SYSTEM,
      output_config: { effort: "low" },
      tools: [{ type: toolType, name: "web_search", max_uses: MAX_SEARCHES, allowed_domains: domains }],
      messages,
    }, MAX_SEARCHES);
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content }); // the server paused a long search: continue it
      continue;
    }
    if (res.stop_reason !== "end_turn") return [];
    return parseResearch(res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(""));
  }
  return [];
}

/** Leads from the trusted domains, one domain group at a time until there are enough. */
export async function research(work: ResearchWork, groups: number[] = domainGroups().map((_, i) => i)): Promise<Lead[]> {
  const all = domainGroups();
  const leads: Lead[] = [];
  for (const i of groups) {
    let found: Lead[];
    try {
      found = await ask(work, all[i], "web_search_20260209");
    } catch (e) {
      // Models before the dynamic-filtering search tool only accept the basic one.
      if (!(e instanceof Anthropic.BadRequestError) || !/web_search/i.test(e.message)) throw e;
      found = await ask(work, all[i], "web_search_20250305");
    }
    for (const l of found) if (!leads.some((x) => x.url === l.url && x.name === l.name)) leads.push(l);
    if (leads.length >= ENOUGH) break;
  }
  return leads;
}
