import { describe, it, expect, vi, afterEach } from "vitest";
import { sameOrigin, requestOrigin } from "../lib/http";
afterEach(() => vi.unstubAllEnvs());
describe("request origin boundaries", () => {
  it("uses Vercel production and deployment hosts when APP_URL is still localhost", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "contract.vercel.app");
    vi.stubEnv("VERCEL_URL", "contract-build-123.vercel.app");
    for (const host of [
      "contract.vercel.app",
      "contract-build-123.vercel.app",
    ]) {
      const req = new Request("http://localhost:3000/api/contracts", {
        headers: { host, origin: `https://${host}` },
      });
      expect(requestOrigin(req)).toBe(`https://${host}`);
      expect(() => sameOrigin(req)).not.toThrow();
    }
    expect(() =>
      sameOrigin(
        new Request("http://localhost:3000/api", {
          headers: {
            host: "contract.vercel.app",
            origin: "https://evil.invalid",
            "x-forwarded-host": "evil.invalid",
          },
        }),
      ),
    ).toThrow();
    expect(() =>
      sameOrigin(
        new Request("http://localhost:3000/api", {
          headers: { host: "localhost:3000", origin: "http://localhost:3000" },
        }),
      ),
    ).toThrow();
  });
  it("does not accept production origin on a preview deployment", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "contract.vercel.app");
    vi.stubEnv("VERCEL_URL", "contract-preview.vercel.app");
    vi.stubEnv("VERCEL_BRANCH_URL", "contract-git-feature.vercel.app");
    for (const host of [
      "contract-preview.vercel.app",
      "contract-git-feature.vercel.app",
    ]) {
      expect(() =>
        sameOrigin(
          new Request(`https://${host}/api`, {
            headers: { host, origin: `https://${host}` },
          }),
        ),
      ).not.toThrow();
    }
    expect(() =>
      sameOrigin(
        new Request("https://contract-preview.vercel.app/api", {
          headers: { origin: "https://contract.vercel.app" },
        }),
      ),
    ).toThrow();
  });
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
