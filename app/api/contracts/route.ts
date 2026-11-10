import { owner, mutate, sha256 } from "@/lib/contracts";
import { adminClient } from "@/lib/supabase/server";
import { draftSchema } from "@/lib/domain";
import { fail, json, readJson, sameOrigin } from "@/lib/http";
export async function GET() {
  try {
    const user = await owner();
    const { data, error } = await adminClient()
      .from("contracts")
      .select("*,parties:contract_parties(*)")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return json({ contracts: data });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await owner(),
      draft = draftSchema.parse(await readJson(req));
    const result = await mutate("save", user.id, null, {
      ...draft,
      contentHash: sha256(JSON.stringify(draft.content)),
    });
    return json(result, 201);
  } catch (e) {
    return fail(e);
  }
}
