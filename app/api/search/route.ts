import { NextResponse, type NextRequest } from "next/server";
import { searchCatalogue } from "@/lib/discover-server";

// GET /api/search?q=dark -> { results: [{ kind: "work" | "city" | "country", id, label, places, centre }] }
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });
  try {
    return NextResponse.json({ results: await searchCatalogue(q) }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e) {
    console.error("search failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 503 });
  }
}
