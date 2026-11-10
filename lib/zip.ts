import { inflateRawSync } from "node:zlib";
// Validate the actual terminal directory, then bound every decompression before Mammoth reads it.
export function validateDocxZip(bytes: Buffer) {
  const error = () =>
    new Error("Некорректный, слишком большой или неподдерживаемый DOCX.");
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      // The extractor also resolves the last EOCD signature. Never skip an ambiguous later signature.
      if (i + 22 + bytes.readUInt16LE(i + 20) !== bytes.length) throw error();
      end = i;
      break;
    }
  }
  if (end < 0) throw error();
  const count = bytes.readUInt16LE(end + 10),
    size = bytes.readUInt32LE(end + 12),
    start = bytes.readUInt32LE(end + 16);
  if (
    bytes.readUInt16LE(end + 4) ||
    bytes.readUInt16LE(end + 6) ||
    bytes.readUInt16LE(end + 8) !== count ||
    count < 1 ||
    count > 2000 ||
    size === 0xffffffff ||
    start === 0xffffffff ||
    start + size !== end
  )
    throw error();
  let offset = start,
    total = 0;
  const names = new Set<string>();
  for (let j = 0; j < count; j++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50)
      throw error();
    const flags = bytes.readUInt16LE(offset + 8),
      method = bytes.readUInt16LE(offset + 10),
      compressed = bytes.readUInt32LE(offset + 20),
      declared = bytes.readUInt32LE(offset + 24),
      local = bytes.readUInt32LE(offset + 42);
    const nameLength = bytes.readUInt16LE(offset + 28),
      extraLength = bytes.readUInt16LE(offset + 30),
      commentLength = bytes.readUInt16LE(offset + 32);
    if (
      flags & 1 ||
      bytes.readUInt16LE(offset + 34) ||
      local + 30 > start ||
      compressed === 0xffffffff ||
      declared > 40 * 1024 * 1024 - total ||
      offset + 46 + nameLength + extraLength + commentLength > end
    )
      throw error();
    const name = bytes
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");
    if (names.has(name) || name.split("/").includes("..")) throw error();
    names.add(name);
    if (
      bytes.readUInt32LE(local) !== 0x04034b50 ||
      bytes.readUInt16LE(local + 6) !== flags ||
      bytes.readUInt16LE(local + 8) !== method
    )
      throw error();
    const dataStart =
      local +
      30 +
      bytes.readUInt16LE(local + 26) +
      bytes.readUInt16LE(local + 28);
    if (dataStart + compressed > start) throw error();
    const packed = bytes.subarray(dataStart, dataStart + compressed);
    const actual =
      method === 0
        ? packed
        : method === 8
          ? inflateRawSync(packed, { maxOutputLength: Math.max(1, declared) })
          : null;
    if (!actual || actual.length !== declared) throw error();
    total += actual.length;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== end) throw error();
}
