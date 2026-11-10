import { z } from "zod";
import { owner, mutate, readContract, withUrls, sha256 } from "@/lib/contracts";
import { adminClient } from "@/lib/supabase/server";
import { draftSchema } from "@/lib/domain";
import { fail, json, readJson, sameOrigin } from "@/lib/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, ctx: Context) {
  try {
    const user = await owner();
    return json({
      contract: await withUrls(
        await readContract((await ctx.params).id, user.id),
      ),
    });
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(req: Request, ctx: Context) {
  try {
    sameOrigin(req);
    const user = await owner(),
      id = z.uuid().parse((await ctx.params).id),
      draft = draftSchema.parse(await readJson(req));
    return json(
      await mutate("save", user.id, id, {
        ...draft,
        contentHash: sha256(JSON.stringify(draft.content)),
      }),
    );
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(req: Request, ctx: Context) {
  try {
    sameOrigin(req);
    const user = await owner(),
      id = z.uuid().parse((await ctx.params).id);
    const c = await readContract(id, user.id);
    await mutate("delete", user.id, id);
    for (const f of c.files || [])
      await adminClient().storage.from(f.bucket).remove([f.path]);
    return json({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
