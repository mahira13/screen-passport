import { ImageResponse } from "next/og";
import { getChallenge } from "@/lib/challenges-server";
import { isPassportId } from "@/lib/ids";

export const alt = "A Screen Passport friend challenge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Text only: no film stills or posters.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ch = isPassportId(id) && process.env.SUPABASE_SERVICE_ROLE_KEY ? await getChallenge(id).catch(() => null) : null;
  const name = ch?.collection?.name ?? "Filming places challenge";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#16213A", color: "#F4EFE4", padding: 72 }}>
        <div style={{ fontSize: 32, color: "#E3B04B", letterSpacing: 4 }}>SCREEN PASSPORT · FRIEND CHALLENGE</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>{name}</div>
          <div style={{ fontSize: 40, marginTop: 24 }}>
            {ch?.collection ? `Who checks in at all ${ch.goal.length} places first? ${ch.people.length} playing.` : "Who checks in everywhere first?"}
          </div>
        </div>
        <div style={{ fontSize: 28, opacity: 0.8 }}>Join with your first name</div>
      </div>
    ),
    size,
  );
}
