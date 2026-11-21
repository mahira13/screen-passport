import { NextResponse, type NextRequest } from "next/server";
import { findCity } from "@/lib/cities";
import { parseLatLng } from "@/lib/distance";
import { getLiveData } from "@/lib/live-data";
import { buildNearby } from "@/lib/nearby";

// GET /api/nearby?city=berlin  or  /api/nearby?lat=52.520&lng=13.405
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const city = findCity(q.get("city"));
  const from = city ?? parseLatLng(q.get("lat"), q.get("lng"));
  if (!from) return NextResponse.json({ error: "Pass a known city or lat and lng." }, { status: 400 });

  const data = await getLiveData();
  return NextResponse.json(buildNearby(data.locations, data.works, from), {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
