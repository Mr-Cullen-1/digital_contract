import { describe, it, expect } from "vitest";
import { sameOrigin, requestOrigin } from "../lib/http";
describe("request origin boundaries", () => {
  it("accepts loopback browser origin despite Next internal hostname normalization", () => {
    const req = new Request("http://localhost:3000/api/contracts", {
      headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" },
    });
    expect(() => sameOrigin(req)).not.toThrow();
    expect(requestOrigin(req)).toBe("http://127.0.0.1:3000");
  });
  it("rejects cross-site requests and ignores untrusted forwarded-host headers", () => {
    expect(() =>
      sameOrigin(
        new Request("http://localhost:3000/api", {
          headers: {
            origin: "https://evil.invalid",
            host: "localhost:3000",
            "x-forwarded-host": "evil.invalid",
          },
        }),
      ),
    ).toThrow();
    expect(() =>
      sameOrigin(new Request("http://localhost:3000/api")),
    ).toThrow();
  });
});
