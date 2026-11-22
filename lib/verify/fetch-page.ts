// Fetching an evidence page server-side: http(s) only, public addresses only (every redirect is
// checked), 15 s timeout, at most 2 MB read, HTML or plain text only.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const x = ip.toLowerCase();
  return x === "::" || x === "::1" || /^f[cd]/.test(x) || /^fe[89ab]/.test(x);
}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("not http(s)");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (!addrs.length || addrs.some(isPrivateAddress)) throw new Error("not a public address");
}

export type PageResult = { ok: true; url: string; html: string } | { ok: false; reason: string };

export async function fetchPage(raw: string, contact: string): Promise<PageResult> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "bad URL" };
  }
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublic(url);
      const res = await fetch(url, {
        redirect: "manual",
        signal,
        headers: { "User-Agent": `ScreenPassport-verifier/0.1 (${contact})`, Accept: "text/html,text/plain;q=0.9" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url);
        continue;
      }
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
      const type = res.headers.get("content-type") ?? "";
      if (!/text\/html|text\/plain|application\/xhtml/.test(type)) return { ok: false, reason: `not a web page (${type || "no type"})` };
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.length;
        if (size >= MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
      return { ok: true, url: url.toString(), html: new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES)) };
    }
    return { ok: false, reason: "too many redirects" };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "fetch failed" };
  }
}
