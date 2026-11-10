import { beforeEach, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  lookup: vi.fn(),
  download: vi.fn(),
  createSignedUrl: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../lib/supabase/server", () => ({
  requireUser: vi.fn(),
  adminClient: () => ({
    rpc: boundary.rpc,
    storage: {
      from: () => ({
        upload: boundary.upload,
        remove: boundary.remove,
        download: boundary.download,
        createSignedUrl: boundary.createSignedUrl,
      }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ limit: boundary.lookup }) }),
    }),
  }),
}));
vi.mock("../lib/documents", () => ({
  validateSignature: async () => Buffer.from("validated PNG"),
}));
import { applySignature, verifiedDownload, sha256 } from "../lib/contracts";
beforeEach(() => {
  vi.resetAllMocks();
  boundary.upload.mockResolvedValue({ error: null });
  boundary.lookup.mockResolvedValue({ error: null, data: [] });
});
it("does not issue a download URL for tampered final bytes", async () => {
  boundary.download.mockResolvedValue({
    data: new Blob(["tampered"]),
    error: null,
  });
  await expect(
    verifiedDownload(
      {
        bucket: "finals",
        path: "contract/final.pdf",
        sha256: sha256("original"),
      },
      "CTR-2026-000001.pdf",
    ),
  ).rejects.toThrow("Контрольная сумма");
  expect(boundary.createSignedUrl).not.toHaveBeenCalled();
});
it("returns a short-lived URL after verifying a large final PDF", async () => {
  const bytes = Buffer.alloc(5 * 1024 * 1024, 32);
  boundary.download.mockResolvedValue({ data: new Blob([bytes]), error: null });
  boundary.createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://example.supabase.co/storage/signed" },
    error: null,
  });
  const result = await verifiedDownload(
    { bucket: "finals", path: "contract/final.pdf", sha256: sha256(bytes) },
    "CTR-2026-000001.pdf",
  );
  expect(result.url).toBe("https://example.supabase.co/storage/signed");
  expect(boundary.createSignedUrl).toHaveBeenCalledWith(
    "contract/final.pdf",
    60,
    { download: "CTR-2026-000001.pdf" },
  );
});
it("retains an uploaded signature when the RPC response is lost before a later commit", async () => {
  let commit: () => void = () => {};
  let committed = false;
  boundary.rpc.mockImplementation(() => {
    commit = () => {
      committed = true;
    };
    return Promise.reject(new Error("response lost"));
  });
  await expect(
    applySignature("sign", null, "contract", "png", {}),
  ).rejects.toThrow("response lost");
  expect(boundary.upload).toHaveBeenCalledOnce();
  expect(boundary.lookup).not.toHaveBeenCalled();
  expect(boundary.remove).not.toHaveBeenCalled();
  commit();
  expect(committed).toBe(true);
  expect(boundary.remove).not.toHaveBeenCalled();
});
it("never deletes a referenced signature after a successful commit", async () => {
  boundary.rpc.mockResolvedValue({ data: { id: "contract" }, error: null });
  boundary.lookup.mockResolvedValue({
    data: [{ id: "signature" }],
    error: null,
  });
  await applySignature("send", "owner", "contract", "png", {});
  expect(boundary.lookup).toHaveBeenCalled();
  expect(boundary.remove).not.toHaveBeenCalled();
});
