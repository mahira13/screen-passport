import { NextResponse, type NextRequest } from "next/server";
import { startFromHint } from "@/lib/cities";
import { getCities } from "@/lib/cities-server";

// GET /api/start -> {city, source}: where Discover starts for a visitor who hasn't picked a start.
// Reads Vercel's IP location headers as a hint only. Nothing is logged or stored, and the answer
// is never cached, because it differs per visitor.
export async function GET(req: NextRequest) {
  const h = req.headers;
  const decode = (v: string | null) => (v ? decodeURIComponent(v) : null);
  const { city, source } = startFromHint(await getCities(), {
    country: decode(h.get("x-vercel-ip-country")),
    lat: decode(h.get("x-vercel-ip-latitude")),
    lng: decode(h.get("x-vercel-ip-longitude")),
  });
  return NextResponse.json({ city: city?.id ?? null, source }, { headers: { "Cache-Control": "private, no-store" } });
}
