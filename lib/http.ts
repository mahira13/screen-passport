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
