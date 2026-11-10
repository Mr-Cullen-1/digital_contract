import { it, expect } from "vitest";
import { spawnSync } from "node:child_process";
function check(app: string, host = "contract.vercel.app") {
  return spawnSync(process.execPath, ["scripts/check-deploy-env.mjs"], {
    encoding: "utf8",
    env: {
      ...process.env,
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_URL: host,
      VERCEL_PROJECT_PRODUCTION_URL: host,
      VERCEL_BRANCH_URL: "",
      NEXT_PUBLIC_APP_URL: app,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      SUPABASE_SECRET_KEY: "sb_secret_test",
    },
  });
}
it.each(["", "http://localhost:3000"])(
  "allows initial Vercel build with APP_URL=%s",
  (app) => {
    const result = check(app);
    expect(result.status, result.stderr).toBe(0);
  },
);
it("accepts an explicit HTTPS custom domain", () => {
  const result = check("https://contracts.example.com");
  expect(result.status, result.stderr).toBe(0);
});
it("rejects a malformed explicit URL and a missing trusted deployment origin", () => {
  expect(check("not a URL").status).not.toBe(0);
  expect(check("", "").status).not.toBe(0);
});
