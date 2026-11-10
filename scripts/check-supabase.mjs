import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (base.protocol !== "https:" || !base.hostname.endsWith(".supabase.co"))
  throw new Error("Expected HTTPS Supabase project URL.");
const checks = [];
async function check(label, path, key, validate) {
  try {
    const response = await fetch(new URL(path, base), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    const ok = response.ok && (!validate || validate(data));
    checks.push({
      check: label,
      status: response.status,
      ok,
      code: typeof data?.code === "string" ? data.code : undefined,
    });
  } catch (e) {
    checks.push({
      check: label,
      ok: false,
      error: e.name,
      code: e.cause?.code,
    });
  }
}
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  secret = process.env.SUPABASE_SECRET_KEY;
if (!publicKey || !secret)
  throw new Error("Missing API keys. Values are never logged.");
await check("Auth settings", "/auth/v1/settings", publicKey);
for (const table of [
  "profiles",
  "contracts",
  "contract_versions",
  "contract_parties",
  "contract_files",
  "contract_signatures",
  "contract_links",
  "contract_events",
  "contract_templates",
  "contract_finalizations",
]) {
  await check(`Schema: ${table}`, `/rest/v1/${table}?select=*&limit=0`, secret);
}
await check("Private buckets", "/storage/v1/bucket", secret, (data) =>
  ["originals", "versions", "signatures", "finals"].every((id) =>
    data.some((b) => b.id === id && b.public === false),
  ),
);
console.log(JSON.stringify({ project: base.hostname, checks }, null, 2));
if (checks.some((c) => !c.ok)) process.exitCode = 1;
