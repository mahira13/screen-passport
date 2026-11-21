import { ImageResponse } from "next/og";
import { isTripId } from "@/lib/ids";
import { formatTripDate } from "@/lib/trip";
import { getTrip } from "@/lib/trip-server";

export const alt = "A Screen Passport fan trip";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Text only: no film stills or posters.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = isTripId(id) && process.env.SUPABASE_SERVICE_ROLE_KEY ? await getTrip(id) : null;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#16213A", color: "#F4EFE4", padding: 72 }}>
        <div style={{ fontSize: 32, color: "#E3B04B", letterSpacing: 4 }}>SCREEN PASSPORT · FAN TRIP</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>{trip?.title ?? "Filming places trip"}</div>
          {trip && (
            <div style={{ fontSize: 40, marginTop: 24 }}>
              {formatTripDate(trip.startsAt)} · {trip.stops.length} stops · meet at {trip.meetingPoint}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {Array.from({ length: Math.min(trip?.stops.length ?? 3, 8) }, (_, i) => (
            <div key={i} style={{ width: 56, height: 56, borderRadius: 28, background: i === 0 ? "#E3B04B" : "#F4EFE4", color: "#16213A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700 }}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
