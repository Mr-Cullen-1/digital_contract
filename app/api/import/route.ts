import { configured } from "@/lib/supabase/config";
import { owner } from "@/lib/contracts";
import { inspectDocument } from "@/lib/documents";
import { readUpload } from "@/lib/upload";
import { fail, json, sameOrigin, HttpError } from "@/lib/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    if (configured()) await owner();
    const { name, bytes } = await readUpload(req);
    return json({ name, ...(await inspectDocument(name, bytes)) });
  } catch (e) {
    return fail(e);
  }
}
