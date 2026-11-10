import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
let db: PGlite;
const owner = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
const payload = {
  title: "Test contract",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Условия договора" }],
      },
    ],
  },
  creator: {
    name: "Test",
    address: "Tashkent",
    phone: "+998901234567",
    pinfl: "12345678901234",
    passport: "",
    role: "provider",
  },
  recipientRole: "customer",
  sourceKind: "editor",
  contentHash: "a".repeat(64),
};
async function mutate(
  action: string,
  id: string | null,
  data: object = {},
  user = owner,
) {
  const r = await db.query<{ result: Record<string, unknown> }>(
    "select public.vc_mutate($1,$2::uuid,$3::uuid,$4::jsonb) as result",
    [action, user, id, JSON.stringify(data)],
  );
  return r.rows[0].result;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create schema storage; create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); insert into auth.users values ('${owner}'),('${other}'); grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
  );
  const dir = path.resolve("supabase/migrations");
  for (const f of fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
});
afterAll(async () => {
  await db?.close();
});
describe("database lifecycle and authorization", () => {
  it("isolates owners and denies anonymous RPC mutation", async () => {
    const c = await mutate("save", null, payload);
    expect(c.id).toBeTruthy();
    await expect(
      mutate("save", c.id as string, payload, other),
    ).rejects.toThrow();
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub='${other}'`,
    );
    expect(
      (await db.query("select * from public.contracts")).rows,
    ).toHaveLength(0);
    await expect(
      db.exec(`update public.contracts set title='attack'`),
    ).rejects.toThrow();
    await db.exec("reset role; set role anon");
    await expect(mutate("save", null, payload)).rejects.toThrow();
    await db.exec("reset role");
  });
  it("freezes sent content, rejects revoked invitations, and closes only with both signatures", async () => {
    const c = await mutate("save", null, payload);
    const id = c.id as string;
    await expect(mutate("reserve_close", id)).rejects.toThrow();
    await mutate("send", id, {
      tokenHash: "b".repeat(64),
      signaturePath: `${id}/creator.png`,
      signatureHash: "c".repeat(64),
      versionId: c.versionId,
    });
    await expect(mutate("save", id, payload)).rejects.toThrow();
    await expect(
      db.query("update contracts set current_version_id=null where id=$1", [
        id,
      ]),
    ).rejects.toThrow();
    await mutate("cancel", id);
    await expect(
      mutate("sign", id, {
        tokenHash: "b".repeat(64),
        party: { ...payload.creator, role: "customer" },
        signaturePath: `${id}/recipient.png`,
        signatureHash: "d".repeat(64),
        versionId: c.versionId,
      }),
    ).rejects.toThrow();
  });
  it("keeps closing retries stable and protects all closed children", async () => {
    const c = await mutate("save", null, payload);
    const id = c.id as string;
    await mutate("send", id, {
      tokenHash: "e".repeat(64),
      signaturePath: `${id}/creator.png`,
      signatureHash: "c".repeat(64),
      versionId: c.versionId,
    });
    await mutate("sign", id, {
      tokenHash: "e".repeat(64),
      party: { ...payload.creator, role: "customer" },
      signaturePath: `${id}/recipient.png`,
      signatureHash: "d".repeat(64),
      versionId: c.versionId,
    });
    await expect(
      mutate("sign", id, { tokenHash: "e".repeat(64) }),
    ).rejects.toThrow();
    await db.exec("select setval('public.contract_number_seq',999999)");
    const one = await mutate("reserve_close", id),
      two = await mutate("reserve_close", id);
    expect(one.number).toMatch(/^CTR-\d{4}-1000000$/);
    expect(one.number).toBe(two.number);
    await mutate("complete_close", id, {
      number: one.number,
      path: `${id}/final.pdf`,
      sha256: "f".repeat(64),
    });
    expect((await mutate("reserve_close", id)).number).toBe(one.number);
    await mutate("share", id, { tokenHash: "9".repeat(64) });
    await expect(mutate("revoke_links", id, {}, other)).rejects.toThrow();
    await mutate("revoke_links", id);
    const active = await db.query(
      "select id from contract_links where contract_id=$1 and revoked_at is null",
      [id],
    );
    expect(active.rows).toHaveLength(0);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from contracts where id=$1",
          [id],
        )
      ).rows[0].status,
    ).toBe("Closed");
    await expect(
      db.query("update contracts set title=$1 where id=$2", ["tamper", id]),
    ).rejects.toThrow();
    await expect(
      db.query("delete from contract_parties where contract_id=$1", [id]),
    ).rejects.toThrow();
    await expect(
      db.query("update contract_versions set content=$1 where contract_id=$2", [
        "{}",
        id,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query("delete from contract_signatures where contract_id=$1", [id]),
    ).rejects.toThrow();
    await expect(mutate("delete", id)).rejects.toThrow();
  });
});
