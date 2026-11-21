import { describe, expect, it } from "vitest";
import { clientIp, hashIp } from "@/lib/client-ip";

describe("clientIp", () => {
  it("takes the first forwarded address, then x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("hashIp", () => {
  it("is a salted 64-char hash that never contains the IP", () => {
    const h = hashIp("1.2.3.4", "salt");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(hashIp("1.2.3.4", "other"));
  });
});
