import fs from "node:fs";
import path from "node:path";
const migration = "20261110061126_vertex_contract.sql";
const sql = fs.readFileSync(
  path.join("supabase/migrations", migration),
  "utf8",
);
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const bundle = `-- Vertex Contract: initial migration for an empty project.
-- Run the whole file in Supabase SQL Editor. No secrets included.
-- If any statement fails, all changes in this transaction roll back.
begin;
set local lock_timeout='10s';
set local statement_timeout='90s';
${sql}
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text
);
insert into supabase_migrations.schema_migrations(version, statements, name)
values ('20261110061126', array[${quote(sql)}], 'vertex_contract');
commit;
`;
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync("artifacts/supabase-bootstrap.sql", bundle);
console.log(
  "Prepared artifacts/supabase-bootstrap.sql (transaction + migration history).",
);
