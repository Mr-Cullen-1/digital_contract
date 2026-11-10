import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/http";
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get("code");
  if (code) {
    const { error } = await (
      await userClient()
    ).auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(new URL("/", requestOrigin(request)));
  }
  return NextResponse.redirect(
    new URL("/login?error=callback", requestOrigin(request)),
  );
}
