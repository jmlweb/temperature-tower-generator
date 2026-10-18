const TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i += 1) {
  let value = i
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1
  TABLE[i] = value >>> 0
}

/** Standard CRC-32 (zlib polynomial), as libbgcode computes block checksums. `seed` chains calls. */
export const crc32 = (bytes: Uint8Array, seed = 0): number => {
  let crc = (seed ^ 0xffffffff) >>> 0
  for (let i = 0; i < bytes.length; i += 1) crc = TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
