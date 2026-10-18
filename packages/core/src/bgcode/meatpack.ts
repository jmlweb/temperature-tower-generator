/**
 * MeatPack as implemented in libbgcode (`binarize/meatpack.cpp`), the encoding
 * PrusaSlicer uses for G-code blocks. The encoder is a byte-for-byte port so the
 * packed stream of an unchanged line equals what the slicer wrote; the decoder
 * is a port of the firmware state machine, including its space re-insertion on
 * `G` lines and its collapsing of blank lines.
 */
const SIGNAL = 0xff
const CMD_ENABLE_PACKING = 251
const CMD_DISABLE_PACKING = 250
const CMD_RESET_ALL = 249
const CMD_ENABLE_NO_SPACES = 247
const CMD_DISABLE_NO_SPACES = 246
const BOTH_UNPACKABLE = 0xff
const FIRST_NOT_PACKED = 0x0f
const SECOND_NOT_PACKED = 0xf0

const NEWLINE = 0x0a
const SEMICOLON = 0x3b
const SPACE = 0x20
const TAB = 0x09
const CR = 0x0d

/** Nibble values in no-spaces mode: `E` takes the slot of the space. */
const VALUE = new Uint8Array(256).fill(0xff)
const PACKABLE = new Uint8Array(256)
for (let digit = 0; digit <= 9; digit += 1) VALUE[0x30 + digit] = digit
VALUE[0x2e] = 10 // .
VALUE[0x45] = 11 // E (space slot in no-spaces mode)
VALUE[NEWLINE] = 12
VALUE[0x47] = 13 // G
VALUE[0x58] = 14 // X
VALUE[0] = 15 // the reference table has a NUL entry; 0b1111 means "next byte is a full character"
for (let i = 0; i < 256; i += 1) PACKABLE[i] = VALUE[i] !== 0xff ? 1 : 0

export interface MeatpackOptions {
  /** Drop whole-line comments (`MeatPack`) instead of keeping them raw (`MeatPackComments`). */
  readonly removeComments: boolean
}

const isBlank = (byte: number): boolean => byte === SPACE || byte === TAB

/** libbgcode's `trim`: strips spaces and tabs at both ends, but not line endings. */
const trimEnds = (line: Uint8Array): Uint8Array => {
  if (line.length === 0) return line
  let start = 0
  while (start < line.length - 1 && isBlank(line[start]!)) start += 1
  let end = line.length - 1
  while (end > 0 && isBlank(line[end]!)) end -= 1
  if ((start === end && isBlank(line[end]!)) || start > end) return new Uint8Array(0)
  return line.subarray(start, end + 1)
}

const firstNonBlank = (line: Uint8Array): number => {
  let i = 0
  while (i < line.length && isBlank(line[i]!)) i += 1
  return i
}

/** The reference "unified method": lines holding `G<digit>` lose their spaces and get upper-cased axes. */
const unifyGLine = (line: Uint8Array): Uint8Array => {
  const g = line.indexOf(0x47)
  if (g === -1 || g + 1 >= line.length || line[g + 1]! < 0x30 || line[g + 1]! > 0x39) return line
  const result: number[] = []
  let hasStar = false
  for (const byte of line) {
    const upper = byte === 0x65 ? 0x45 : byte === 0x78 ? 0x58 : byte === 0x67 ? 0x47 : byte
    if (upper === SPACE) continue
    if (upper === 0x2a) {
      hasStar = true
      continue
    }
    result.push(upper)
  }
  if (hasStar) {
    let checksum = 0
    for (const byte of result) checksum ^= byte
    result.push(0x2a, ...Array.from(String(checksum), (c) => c.charCodeAt(0)))
  }
  result.push(NEWLINE)
  return Uint8Array.from(result)
}

export const meatpackEncode = (input: Uint8Array, { removeComments }: MeatpackOptions): Uint8Array => {
  const out: number[] = []
  const command = (code: number): void => {
    out.push(SIGNAL, SIGNAL, code)
  }
  const pack = (low: number, high: number): number => ((VALUE[high]! & 0xf) << 4) | (VALUE[low]! & 0xf)

  command(CMD_ENABLE_PACKING)
  command(CMD_ENABLE_NO_SPACES)
  let packing = true

  let start = 0
  while (start < input.length) {
    let end = input.indexOf(NEWLINE, start)
    end = end === -1 ? input.length : end + 1
    const line = input.subarray(start, end)
    start = end

    const skip = firstNonBlank(line)
    const trimmedLeft = line.subarray(skip)
    if (!removeComments && trimmedLeft.length > 0 && trimmedLeft[0] === SEMICOLON) {
      if (packing) {
        command(CMD_DISABLE_PACKING)
        packing = false
      }
      for (const byte of line) out.push(byte)
      continue
    }
    if (trimmedLeft.length === 0 || trimmedLeft[0] === SEMICOLON || trimmedLeft[0] === NEWLINE || trimmedLeft[0] === CR || line.length < 2) continue

    const semicolon = line.indexOf(SEMICOLON)
    let modified = trimEnds(semicolon === -1 ? line : line.subarray(0, semicolon))
    if (modified.length === 0) continue
    modified = unifyGLine(modified)
    if (modified[modified.length - 1] !== NEWLINE) {
      const withNewline = new Uint8Array(modified.length + 1)
      withNewline.set(modified)
      withNewline[modified.length] = NEWLINE
      modified = withNewline
    }

    const packed: number[] = []
    for (let i = 0; i < modified.length; i += 2) {
      const c1 = modified[i]!
      const c2 = i === modified.length - 1 ? NEWLINE : modified[i + 1]!
      const p1 = PACKABLE[c1] === 1
      const p2 = PACKABLE[c2] === 1
      if (p1 && p2) packed.push(pack(c1, c2))
      else if (p1) packed.push(pack(c1, 0), c2)
      else if (p2) packed.push(pack(0, c2), c1)
      else packed.push(BOTH_UNPACKABLE, c1, c2)
    }
    if (!packing && packed.length > 0) {
      command(CMD_ENABLE_PACKING)
      packing = true
    }
    for (const byte of packed) out.push(byte)
  }
  if (removeComments) command(CMD_RESET_ALL)
  return Uint8Array.from(out)
}

const G_LINE_PARAMETERS = new Set('XYZEFIJRSGPWHCA'.split('').map((c) => c.charCodeAt(0)))

export const meatpackDecode = (input: Uint8Array): Uint8Array => {
  let out = new Uint8Array(Math.max(64, input.length * 2))
  let outLength = 0
  const push = (byte: number): void => {
    if (outLength === out.length) {
      const grown = new Uint8Array(out.length * 2)
      grown.set(out)
      out = grown
    }
    out[outLength++] = byte
  }

  let unpacking = false
  let noSpaces = false
  let commandPending = false
  let signalCount = 0
  let fullCharQueue = 0
  let heldChar = 0
  const pending: number[] = []
  let addSpace = false

  const nibbleChar = (value: number): number => {
    if (value <= 9) return 0x30 + value
    switch (value) {
      case 10:
        return 0x2e
      case 11:
        return noSpaces ? 0x45 : SPACE
      case 12:
        return NEWLINE
      case 13:
        return 0x47
      case 14:
        return 0x58
      default:
        return 0
    }
  }

  const handleCommand = (code: number): void => {
    if (code === CMD_ENABLE_PACKING) unpacking = true
    else if (code === CMD_DISABLE_PACKING || code === CMD_RESET_ALL) unpacking = false
    else if (code === CMD_ENABLE_NO_SPACES) noSpaces = true
    else if (code === CMD_DISABLE_NO_SPACES) noSpaces = false
  }

  const receive = (byte: number): void => {
    if (!unpacking) {
      pending.push(byte)
      return
    }
    if (fullCharQueue > 0) {
      pending.push(byte)
      if (heldChar > 0) {
        pending.push(heldChar)
        heldChar = 0
      }
      fullCharQueue -= 1
      return
    }
    const firstNotPacked = (byte & FIRST_NOT_PACKED) === FIRST_NOT_PACKED
    const secondNotPacked = (byte & SECOND_NOT_PACKED) === SECOND_NOT_PACKED
    const low = firstNotPacked ? 0 : nibbleChar(byte & 0xf)
    const high = secondNotPacked ? 0 : nibbleChar((byte >> 4) & 0xf)
    if (firstNotPacked) {
      fullCharQueue += 1
      if (secondNotPacked) fullCharQueue += 1
      else heldChar = high
      return
    }
    pending.push(low)
    if (low !== NEWLINE) {
      if (secondNotPacked) fullCharQueue += 1
      else pending.push(high)
    }
  }

  for (let i = 0; i < input.length; i += 1) {
    const byte = input[i]!
    if (byte === SIGNAL) {
      if (signalCount > 0) {
        commandPending = true
        signalCount = 0
      } else {
        signalCount += 1
      }
    } else if (commandPending) {
      handleCommand(byte)
      commandPending = false
    } else {
      if (signalCount > 0) {
        receive(SIGNAL)
        signalCount = 0
      }
      receive(byte)
    }

    // The firmware inserts the spaces MeatPack removed from G lines and drops repeated newlines.
    for (const c of pending) {
      const previous = outLength === 0 ? NEWLINE : out[outLength - 1]!
      let newLine = false
      if (c === 0x47 && (outLength === 0 || previous === NEWLINE)) {
        addSpace = true
        newLine = true
      } else if (c === NEWLINE) {
        addSpace = false
      }
      if (!newLine && addSpace && (outLength === 0 || previous !== SPACE) && G_LINE_PARAMETERS.has(c)) push(SPACE)
      if (c !== NEWLINE || outLength === 0 || out[outLength - 1] !== NEWLINE) push(c)
    }
    pending.length = 0
  }
  return out.subarray(0, outLength)
}
