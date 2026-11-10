// Explicit live verification with disposable users and a draft. Never run from CI.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import assert from "node:assert/strict";
nextEnv.loadEnvConfig(process.cwd());
if (!process.argv.includes("--write-test"))
  throw new Error(
    "Pass --write-test to create and remove disposable QA users/draft/files.",
  );
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (
  new URL(url).protocol !== "https:" ||
  !new URL(url).hostname.endsWith(".supabase.co")
)
  throw new Error("Unexpected project URL");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, options);
const anonymous = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  options,
);
const users = [],
  sessions = [],
  objects = [],
  results = [];
const run = randomUUID();
let draftId;
const hash = (b) => createHash("sha256").update(b).digest("hex");
function ok(result, label) {
  if (result.error)
    throw new Error(
      `${label}: ${result.error.code || result.error.status || result.error.name}`,
    );
  return result.data;
}
try {
  for (let i = 0; i < 2; i++) {
    const email = `vertex-qa-${run}-${i}@example.invalid`,
      password = randomBytes(32).toString("base64url");
    const { user } = ok(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { purpose: "vertex-contract-disposable-qa", run },
      }),
      "Create QA user",
    );
    users.push(user.id);
    const client = createClient(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      options,
    );
    ok(
      await client.auth.signInWithPassword({ email, password }),
      "Email/password login",
    );
    sessions.push(client);
  }
  results.push("Auth: two disposable users can sign in");
  const content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Disposable QA document" }],
      },
    ],
  };
  const created = ok(
    await admin.rpc("vc_mutate", {
      p_action: "save",
      p_owner: users[0],
      p_id: null,
      p_data: {
        title: `[QA] ${run}`,
        content,
        contentHash: hash(JSON.stringify(content)),
        creator: {
          name: "QA fixture",
          address: "Test only",
          phone: "+998000000000",
          pinfl: "00000000000000",
          passport: "",
        },
        recipientRole: "customer",
        sourceKind: "editor",
      },
    }),
    "Create draft",
  );
  draftId = created.id;
  const own = ok(
    await sessions[0].from("contracts").select("id").eq("id", draftId),
    "Owner read",
  );
  assert.equal(own.length, 1);
  const foreign = ok(
    await sessions[1].from("contracts").select("id").eq("id", draftId),
    "Other owner read",
  );
  assert.equal(foreign.length, 0);
  assert.ok(
    (await anonymous.from("contracts").select("id").eq("id", draftId)).error,
  );
  assert.ok(
    (
      await sessions[0].rpc("vc_mutate", {
        p_action: "delete",
        p_owner: users[0],
        p_id: draftId,
        p_data: {},
      })
    ).error,
  );
  assert.ok(
    (
      await sessions[0]
        .from("contracts")
        .update({ title: "forbidden" })
        .eq("id", draftId)
    ).error,
  );
  results.push(
    "Database: server RPC works; owner isolation and browser mutation restrictions hold",
  );
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  const objectPath = `${draftId}/qa-${run}.pdf`;
  ok(
    await admin.storage
      .from("originals")
      .upload(objectPath, bytes, {
        contentType: "application/pdf",
        upsert: false,
      }),
    "Private storage upload",
  );
  objects.push({ bucket: "originals", path: objectPath });
  const read = ok(
    await sessions[0].storage.from("originals").download(objectPath),
    "Owner storage read",
  );
  assert.equal(hash(Buffer.from(await read.arrayBuffer())), hash(bytes));
  assert.ok(
    (await sessions[1].storage.from("originals").download(objectPath)).error,
  );
  const signed = ok(
    await admin.storage.from("originals").createSignedUrl(objectPath, 60),
    "Signed download",
  );
  const response = await fetch(signed.signedUrl);
  assert.equal(response.status, 200);
  assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(bytes));
  results.push(
    "Storage: private upload, owner access, foreign-owner denial, signed download and SHA-256 verified",
  );
} catch (e) {
  results.push(`FAILED: ${e.message}`);
  process.exitCode = 1;
} finally {
  const cleanupErrors = [];
  for (const object of objects) {
    const r = await admin.storage.from(object.bucket).remove([object.path]);
    if (r.error) cleanupErrors.push(`object ${object.path}`);
  }
  if (draftId) {
    const r = await admin.rpc("vc_mutate", {
      p_action: "delete",
      p_owner: users[0],
      p_id: draftId,
      p_data: {},
    });
    if (r.error) cleanupErrors.push(`draft ${draftId}`);
  }
  for (const client of sessions) {
    await client.auth.signOut();
  }
  for (const id of users) {
    const r = await admin.auth.admin.deleteUser(id);
    if (r.error) cleanupErrors.push(`user ${id}`);
  }
  if (cleanupErrors.length) {
    results.push(`CLEANUP INCOMPLETE: ${cleanupErrors.join(", ")}`);
    process.exitCode = 1;
  } else
    results.push("Cleanup: disposable users, draft and storage object removed");
  console.log(
    JSON.stringify({ run, project: new URL(url).hostname, results }, null, 2),
  );
}
