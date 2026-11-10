import { z } from "zod";
export const maxDuration = 60;
import {
  owner,
  readContract,
  mutate,
  newToken,
  sha256,
  applySignature,
  closeContract,
} from "@/lib/contracts";
import { partySchema, documentText } from "@/lib/domain";
import { assertPdfTextSupported } from "@/lib/pdf";
import {
  fail,
  json,
  readJson,
  sameOrigin,
  requestOrigin,
  HttpError,
} from "@/lib/http";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(req);
    const user = await owner(),
      id = z.uuid().parse((await ctx.params).id);
    const body = await readJson(req);
    const action = z
      .enum([
        "send",
        "cancel",
        "rotate_link",
        "share",
        "close",
        "copy",
        "revoke_links",
      ])
      .parse(body.action);
    const c = await readContract(id, user.id);
    if (action === "close") {
      await closeContract(id, user.id);
      return json({ id });
    }
    if (action === "copy") {
      // Copy the immutable source into a new editable draft. Original PDF needs its own storage copy.
      const creator = c.parties?.find((p) => p.side === "creator");
      const result = await mutate("save", user.id, null, {
        title: `${c.title.slice(0, 185)} — копия`,
        content: c.version!.content,
        contentHash: c.version!.content_hash,
        creator,
        recipientRole: c.recipient_role,
        sourceKind: c.source_kind,
      });
      const original = c.files?.find((f) => f.kind === "original");
      if (original) {
        const { fileBytes, storeFile } = await import("@/lib/contracts");
        const bytes = await fileBytes(original);
        const path = await storeFile(
          "originals",
          result.id,
          bytes,
          c.source_kind === "pdf" ? "pdf" : "docx",
          original.mime,
        );
        await mutate("attach", user.id, result.id, {
          path,
          name: original.name,
          mime: original.mime,
          sha256: original.sha256,
        });
      }
      return json(result);
    }
    if (action === "cancel" || action === "revoke_links")
      return json(await mutate(action, user.id, id));
    const token = newToken();
    const tokenHash = sha256(token);
    if (action === "send") {
      if (c.status !== "Draft")
        throw new HttpError("Контракт уже отправлен.", 409);
      partySchema.parse(c.parties?.find((p) => p.side === "creator"));
      await assertPdfTextSupported(
        c.title +
          "\n" +
          documentText(c.version!.content) +
          "\n" +
          Object.values(c.parties!.find((p) => p.side === "creator")!)
            .filter((v) => typeof v === "string")
            .join("\n"),
      );
      if (c.source_kind !== "pdf" && !documentText(c.version!.content).trim())
        throw new HttpError("Добавьте условия контракта.");
      if (body.consent !== true)
        throw new HttpError("Подтвердите согласие с документом.");
      const versionId = z.uuid().parse(body.versionId);
      if (versionId !== c.current_version_id)
        throw new HttpError(
          "Версия изменилась. Проверьте документ ещё раз.",
          409,
        );
      await applySignature("send", user.id, id, body.signature, {
        tokenHash,
        versionId,
        userAgent: req.headers.get("user-agent"),
      });
    } else await mutate(action, user.id, id, { tokenHash });
    return json({ id, url: `${requestOrigin(req)}/sign#${token}` });
  } catch (e) {
    return fail(e);
  }
}
