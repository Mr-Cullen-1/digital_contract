import { z } from "zod";
import {
  tokenContract,
  withUrls,
  mutate,
  applySignature,
  verifiedDownload,
} from "@/lib/contracts";
import { partySchema } from "@/lib/domain";
import { assertPdfTextSupported } from "@/lib/pdf";
import { fail, json, readJson, sameOrigin, HttpError } from "@/lib/http";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const body = await readJson(req);
    const { contract: c, link, hash } = await tokenContract(body.token);
    if (body.action === "download") {
      const file = c.files?.find((f) => f.kind === "final");
      if (c.status !== "Closed" || !file)
        throw new HttpError("PDF ещё не готов.", 409);
      return json(await verifiedDownload(file, `${c.number}.pdf`));
    }
    if (body.action === "sign") {
      if (link.purpose !== "sign" || link.used_at || c.status !== "Sent")
        throw new HttpError("Подписание по этой ссылке уже недоступно.", 409);
      if (body.consent !== true)
        throw new HttpError("Подтвердите согласие с документом.");
      const party = partySchema.parse(body.party),
        versionId = z.uuid().parse(body.versionId);
      await assertPdfTextSupported(Object.values(party).join("\n"));
      if (versionId !== c.current_version_id)
        throw new HttpError("Версия документа изменилась.", 409);
      if (party.role !== c.recipient_role)
        throw new HttpError("Роль должна совпадать с приглашением.");
      await applySignature("sign", null, c.id, body.signature, {
        tokenHash: hash,
        party,
        versionId,
        userAgent: req.headers.get("user-agent"),
      });
      return json({ signed: true });
    }
    if (body.action !== "view") throw new HttpError("Неизвестное действие.");
    const full = await withUrls(c);
    const { owner_id: _, events: __, ...safe } = full;
    return json({
      contract: safe,
      canSign: link.purpose === "sign" && !link.used_at && c.status === "Sent",
    });
  } catch (e) {
    return fail(e);
  }
}
