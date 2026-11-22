import { NextResponse, type NextRequest } from "next/server";
import { findCity } from "@/lib/cities";
import { parseRadius } from "@/lib/discover";
import { nearbyAuto, nearbyWithin } from "@/lib/discover-server";
import { parseLatLng } from "@/lib/distance";

// GET /api/nearby?city=berlin  or  /api/nearby?lat=52.520&lng=13.405, optional &radius=5|10|25|50|auto
// (auto also returns the radius it picked).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const city = findCity(q.get("city"));
  const from = city ?? parseLatLng(q.get("lat"), q.get("lng"));
  if (!from) return NextResponse.json({ error: "Pass a known city or lat and lng." }, { status: 400 });

  try {
    const radius = q.get("radius");
    const result = radius === "auto" ? await nearbyAuto(from) : await nearbyWithin(from, parseRadius(radius));
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e) {
    console.error("nearby failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't load places." }, { status: 503 });
  }
}
