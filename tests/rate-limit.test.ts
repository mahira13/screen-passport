import { describe, expect, it } from "vitest";
import { perIpLimitsOff } from "@/lib/rate-limit";

describe("perIpLimitsOff", () => {
  it("is off in dev or with RATE_LIMITS=off, on in production", () => {
    expect(perIpLimitsOff({ NODE_ENV: "development" })).toBe(true);
    expect(perIpLimitsOff({ NODE_ENV: "production", RATE_LIMITS: "off" })).toBe(true);
    expect(perIpLimitsOff({ NODE_ENV: "production" })).toBe(false);
    expect(perIpLimitsOff({ NODE_ENV: "production", RATE_LIMITS: "on" })).toBe(false);
  });
});
