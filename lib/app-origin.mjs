// Shared by the build check and server request validation. Only configuration,
// never an arbitrary request header, adds a trusted origin.
export function vercelOrigins(env = process.env) {
  const origins = [];
  const explicit = env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    const url = new URL(explicit);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      (!local && url.protocol !== "https:") ||
      (local && !["http:", "https:"].includes(url.protocol))
    ) {
      throw new Error(
        "NEXT_PUBLIC_APP_URL must be an HTTPS origin without a path or credentials.",
      );
    }
    // A copied development .env must not block the first Vercel deployment.
    if (!local) origins.push(url.origin);
  }
  const hosts = [
    env.VERCEL_ENV === "production"
      ? env.VERCEL_PROJECT_PRODUCTION_URL
      : undefined,
    env.VERCEL_URL,
    env.VERCEL_BRANCH_URL,
  ];
  for (const host of hosts.filter(Boolean)) {
    const url = new URL(`https://${host}`);
    if (
      url.host !== host ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ) {
      throw new Error("Invalid Vercel system hostname.");
    }
    origins.push(url.origin);
  }
  if (!origins.length) {
    throw new Error(
      "Enable Vercel System Environment Variables or set NEXT_PUBLIC_APP_URL to the public HTTPS origin.",
    );
  }
  return [...new Set(origins)];
}
