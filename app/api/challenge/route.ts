import { NextResponse } from "next/server";
import { createChallenge } from "@/lib/challenges-server";
import { readJson, serverError } from "@/lib/http";
import { requestIpHash } from "@/lib/rate-limit";

// POST {collection, passportId, editKey, firstName} -> {id}
export async function POST(req: Request) {
  try {
    const body = await readJson(req, 1_000);
    if (!body) return NextResponse.json({ error: "Send {collection, passportId, editKey, firstName}." }, { status: 400 });
    const r = await createChallenge(body, requestIpHash(req));
    return r.ok ? NextResponse.json({ id: r.id }, { status: 201 }) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (e) {
    return serverError("create challenge", e);
  }
}
