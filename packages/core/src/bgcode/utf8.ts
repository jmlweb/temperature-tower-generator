/**
 * UTF-8 codec written by hand: the platform text codec classes are not in the
 * ES2022 library the core compiles against (ADR-0002 keeps the core free of
 * platform APIs).
 */
export const utf8Encode = (text: string): Uint8Array => {
  const out = new Uint8Array(text.length * 3)
  let n = 0
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1)
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00)
        i += 1
      }
    }
    if (code < 0x80) {
      out[n++] = code
    } else if (code < 0x800) {
      out[n++] = 0xc0 | (code >> 6)
      out[n++] = 0x80 | (code & 0x3f)
    } else if (code < 0x10000) {
      out[n++] = 0xe0 | (code >> 12)
      out[n++] = 0x80 | ((code >> 6) & 0x3f)
      out[n++] = 0x80 | (code & 0x3f)
    } else {
      out[n++] = 0xf0 | (code >> 18)
      out[n++] = 0x80 | ((code >> 12) & 0x3f)
      out[n++] = 0x80 | ((code >> 6) & 0x3f)
      out[n++] = 0x80 | (code & 0x3f)
    }
  }
  // A tight copy, so the result can be transferred between threads without its slack.
  return out.slice(0, n)
}

/** Decodes UTF-8, replacing malformed sequences with U+FFFD like the platform decoder does. */
export const utf8Decode = (bytes: Uint8Array): string => {
  const parts: string[] = []
  let chunk: number[] = []
  const flush = (): void => {
    if (chunk.length === 0) return
    parts.push(String.fromCharCode(...chunk))
    chunk = []
  }
  let i = 0
  while (i < bytes.length) {
    const b0 = bytes[i]!
    let code: number
    let width: number
    if (b0 < 0x80) {
      code = b0
      width = 1
    } else if (b0 >= 0xc2 && b0 <= 0xdf) {
      code = b0 & 0x1f
      width = 2
    } else if (b0 >= 0xe0 && b0 <= 0xef) {
      code = b0 & 0x0f
      width = 3
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      code = b0 & 0x07
      width = 4
    } else {
      code = 0xfffd
      width = 1
    }
    let valid = width === 1 && code !== 0xfffd
    if (width > 1) {
      valid = i + width <= bytes.length
      for (let k = 1; valid && k < width; k += 1) {
        const b = bytes[i + k]!
        if ((b & 0xc0) !== 0x80) valid = false
        else code = (code << 6) | (b & 0x3f)
      }
      if (valid && ((width === 3 && code < 0x800) || (width === 4 && (code < 0x10000 || code > 0x10ffff)) || (code >= 0xd800 && code <= 0xdfff))) valid = false
    }
    if (!valid) {
      if (b0 < 0x80) {
        chunk.push(b0)
        i += 1
      } else {
        chunk.push(0xfffd)
        i += 1
      }
    } else {
      if (code >= 0x10000) {
        const offset = code - 0x10000
        chunk.push(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff))
      } else {
        chunk.push(code)
      }
      i += width
    }
    if (chunk.length >= 4096) flush()
  }
  flush()
  return parts.join('')
}
