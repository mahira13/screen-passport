import { NextResponse } from "next/server";
import { CHALLENGE_MESSAGES, joinChallenge } from "@/lib/challenges-server";
import { readJson, serverError } from "@/lib/http";
import { isPassportId } from "@/lib/ids";
import { requestIpHash } from "@/lib/rate-limit";

// POST {passportId, editKey, firstName} -> 204
export async function POST(req: Request, ctx: RouteContext<"/api/challenge/[id]/join">) {
  try {
    const { id } = await ctx.params;
    if (!isPassportId(id)) return NextResponse.json({ error: CHALLENGE_MESSAGES.notFound }, { status: 404 });
    const body = await readJson(req, 1_000);
    if (!body) return NextResponse.json({ error: CHALLENGE_MESSAGES.name }, { status: 400 });
    const r = await joinChallenge(id, body, requestIpHash(req));
    return r.ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (e) {
    return serverError("join challenge", e);
  }
}
