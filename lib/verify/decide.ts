// The publish rule (CLAUDE.md product rule 4). Pure; every reason is recorded for the admin page.
import { REGION } from "../region";
import type { CoordQuality, LocationConfidence } from "../types";
import type { Verdict } from "./ai";
import type { GeoCheck } from "./geo";

export interface Checks {
  fetched: boolean;
  aiError?: string; // the model call itself failed (network, quota, key)
  verdict: Verdict | null;
  quoteFound: boolean;
  trusted: boolean;
  geocode: GeoCheck | null;
  duplicateIds: number[]; // published places within 30 m
  existingQuality: CoordQuality | null;
  geocodeFarFromSource: boolean; // a source/verified pin and the geocoder disagree by > 500 m
}

export interface Decision {
  decision: "published" | "needs_review" | "rejected";
  reasons: string[];
  confidence: LocationConfidence | null;
  coordQuality: CoordQuality | null;
}

const PRECISE: (CoordQuality | null)[] = ["source", "verified"];

export function decide(c: Checks): Decision {
  const keep = { confidence: null, coordQuality: c.existingQuality };
  if (!c.fetched) return { decision: "needs_review", reasons: ["source unreachable"], ...keep };
  if (c.aiError) return { decision: "needs_review", reasons: [`AI call failed (${c.aiError})`], ...keep };
  const v = c.verdict;
  if (!v) return { decision: "needs_review", reasons: ["AI answer missing or invalid"], ...keep };
  if (v.filmed_here === false && c.quoteFound) return { decision: "rejected", reasons: ["source says it was not filmed here"], ...keep };

  const reasons: string[] = [];
  if (v.filmed_here !== true) reasons.push(v.filmed_here === "unclear" ? "AI unsure it was filmed here" : "AI says not filmed here");
  if (v.story_setting_only) reasons.push("story setting only");
  if (v.confidence !== "high") reasons.push(`AI confidence ${v.confidence}`);
  if (!c.quoteFound) reasons.push("evidence quote not found on the page");
  if (!c.trusted) reasons.push("domain not trusted");
  const g = c.geocode;
  if (!g) reasons.push("no geocoder match");
  else {
    if (g.kind === "residential") reasons.push("possible private home");
    if (g.kind === "unmatched") reasons.push("geocoder found a different place");
    if (!g.cityMatch) reasons.push("city does not match");
    if (!g.countryMatch) reasons.push(`country is not ${REGION.country}`);
  }
  if (c.geocodeFarFromSource) reasons.push("geocoder result far from the stored pin");
  if (c.duplicateIds.length) reasons.push(`published place within 30 m (#${c.duplicateIds.join(", #")})`);
  if (reasons.length) return { decision: "needs_review", reasons, ...keep };

  const poi = g!.kind === "poi";
  return {
    decision: "published",
    reasons: [],
    confidence: poi ? "building" : "area",
    coordQuality: PRECISE.includes(c.existingQuality) ? c.existingQuality : poi ? "geocoded_poi" : "approx",
  };
}
