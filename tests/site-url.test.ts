import { describe, expect, it } from "vitest";
import { siteUrl } from "@/lib/site-url";

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL, then Vercel's domain, then localhost", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://x.app/", VERCEL_URL: "y.vercel.app" })).toBe("https://x.app");
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "sp.vercel.app", VERCEL_URL: "sp-abc.vercel.app" })).toBe("https://sp.vercel.app");
    expect(siteUrl({ VERCEL_URL: "sp-abc.vercel.app" })).toBe("https://sp-abc.vercel.app");
    expect(siteUrl({})).toBe("http://localhost:3000");
  });
});
