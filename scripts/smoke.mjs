import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
const origin = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const configuredMode = process.argv.includes("--configured");
const results = [];
for (const route of [
  "/",
  "/contracts/new",
  "/contracts/upload",
  "/templates",
  "/guide",
  "/settings",
  "/login",
  "/sign",
]) {
  const response = await fetch(origin + route, { redirect: "manual" });
  if (configuredMode && !["/login", "/sign"].includes(route)) {
    assert.ok(
      [307, 308].includes(response.status),
      `${route} must require login`,
    );
    assert.equal(
      new URL(response.headers.get("location"), origin).pathname,
      "/login",
    );
    results.push({ route, status: response.status });
    continue;
  }
  assert.equal(response.status, 200, route);
  const html = await response.text();
  assert.match(html, /Vertex|vertex/);
  results.push({ route, status: response.status });
}
const blocked = await fetch(origin + "/api/contracts", {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: "{}",
});
assert.equal(blocked.status, configuredMode ? 401 : 503);
results.push({
  check: configuredMode
    ? "Unauthenticated mutation denied"
    : "Unconfigured persistence fails explicitly",
  status: blocked.status,
});
const csrf = await fetch(origin + "/api/contracts", {
  method: "POST",
  headers: {
    Origin: "https://untrusted.invalid",
    "Content-Type": "application/json",
  },
  body: "{}",
});
assert.equal(csrf.status, 403);
results.push({ check: "Cross-origin mutation blocked", status: csrf.status });
if (configuredMode) {
  const response = await fetch(origin + "/api/import", {
    method: "POST",
    headers: { Origin: origin },
  });
  assert.equal(response.status, 401);
  results.push({
    check: "Unauthenticated import denied",
    status: response.status,
  });
  console.log(JSON.stringify(results, null, 2));
} else {
  async function upload(name, bytes) {
    const form = new FormData();
    form.set("file", new File([bytes], name));
    return fetch(origin + "/api/import", {
      method: "POST",
      headers: { Origin: origin },
      body: form,
    });
  }
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const valid = await upload("sample.pdf", await pdf.save());
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).pages, 1);
  const malformed = await upload("broken.pdf", Buffer.from("%PDF-1.7\nbroken"));
  assert.equal(malformed.status, 400);
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    "word/document.xml",
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Локальная проверка импорта</w:t></w:r></w:p></w:body></w:document>',
  );
  const docx = await upload(
    "sample.docx",
    await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
  );
  assert.equal(docx.status, 200);
  assert.equal(
    (await docx.json()).content.content[0].content[0].text,
    "Локальная проверка импорта",
  );
  results.push({
    check: "PDF and DOCX HTTP import; malformed PDF rejected",
    status: "passed",
  });
  console.log(JSON.stringify(results, null, 2));
}
