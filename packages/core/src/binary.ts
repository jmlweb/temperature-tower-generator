const BINARY_MAGIC = [0x47, 0x43, 0x44, 0x45] // "GCDE"

/** PrusaSlicer binary G-code (`.bgcode`) starts with the `GCDE` magic. */
export const isBinaryGcode = (bytes: Uint8Array, fileName = ''): boolean =>
  fileName.toLowerCase().endsWith('.bgcode') || BINARY_MAGIC.every((byte, i) => bytes[i] === byte)
