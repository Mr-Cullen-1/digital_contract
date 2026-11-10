import { owner, readContract, verifiedDownload } from "@/lib/contracts";
import { fail, json, HttpError } from "@/lib/http";
export const maxDuration = 60;
export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await owner(),
      c = await readContract((await ctx.params).id, user.id);
    const file = c.files?.find((f) => f.kind === "final");
    if (c.status !== "Closed" || !file)
      throw new HttpError("Финальный PDF пока не сформирован.", 409);
    return json(await verifiedDownload(file, `${c.number}.pdf`));
  } catch (e) {
    return fail(e);
  }
}
