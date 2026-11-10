export const configured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
export const serverConfigured = () =>
  configured() && Boolean(process.env.SUPABASE_SECRET_KEY);
