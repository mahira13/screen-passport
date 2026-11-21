/** Parses a small JSON object body; null if too big, not JSON or not an object. */
export async function readJson(req: Request, maxChars = 5_000): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > maxChars) return null;
  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export const SERVER_ERROR = "Something went wrong on our side. Please try again in a minute.";

/** Logs the real error and returns a friendly 503 instead of a crash page. */
export function serverError(where: string, e: unknown): Response {
  console.error(`${where}:`, e instanceof Error ? e.message : e);
  return Response.json({ error: SERVER_ERROR }, { status: 503 });
}
