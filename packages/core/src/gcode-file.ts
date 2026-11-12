import { decodeBgcode, hasBgcodeMagic, utf8DecodeReporting, utf8Encode, type BgcodeDocument } from './bgcode/index.ts'
import { GcodeInputError } from './errors.ts'

/**
 * How plain-text bytes map to the text the pipeline sees. `latin1` maps each byte
 * to one code point, so a file that is not valid UTF-8 still round-trips byte for
 * byte (ADR-0002, RPT-006).
 */
export const TextEncoding = { UTF8: 'utf-8', LATIN1: 'latin1' } as const
export type TextEncoding = (typeof TextEncoding)[keyof typeof TextEncoding]

/** An uploaded file after decoding: plain text, or binary G-code with its decoded text (ADR-0007). */
export interface LoadedGcode {
  readonly fileName: string
  /** G-code text the pipeline works on; empty when a binary file could not be decoded. */
  readonly text: string
  readonly binary: BgcodeDocument | null
  /** Why a file that looks binary could not be decoded; null otherwise. */
  readonly binaryError: string | null
  /** Encoding of a plain-text upload, used again for the output. */
  readonly textEncoding: TextEncoding
}

export interface LoadGcodeInput {
  readonly fileName: string
  readonly bytes: Uint8Array
}

/** Binary G-code is recognised by the `.bgcode` extension or the `GCDE` magic. */
export const isBinaryGcode = (bytes: Uint8Array, fileName = ''): boolean => fileName.toLowerCase().endsWith('.bgcode') || hasBgcodeMagic(bytes)

// Chunked because spreading a whole file into fromCharCode exceeds the engine's argument limit.
const CHUNK = 4096

export const latin1Decode = (bytes: Uint8Array): string => {
  const parts: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK) parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)))
  return parts.join('')
}

/** Inverse of `latin1Decode`; inserted lines are ASCII, so every code point fits in a byte. */
export const latin1Encode = (text: string): Uint8Array => {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code > 0xff) throw new GcodeInputError(`Code point U+${code.toString(16).toUpperCase()} at offset ${i} has no single-byte form`)
    out[i] = code
  }
  return out
}

/** UTF-8 unless a byte had to be replaced, then Latin-1, so no input byte is ever lost. */
const decodePlainText = (bytes: Uint8Array): { readonly text: string; readonly textEncoding: TextEncoding } => {
  const { text, hasReplacements } = utf8DecodeReporting(bytes)
  return hasReplacements ? { text: latin1Decode(bytes), textEncoding: TextEncoding.LATIN1 } : { text, textEncoding: TextEncoding.UTF8 }
}

export const encodePlainText = (text: string, textEncoding: TextEncoding): Uint8Array =>
  textEncoding === TextEncoding.LATIN1 ? latin1Encode(text) : utf8Encode(text)

export const loadGcodeFile = ({ fileName, bytes }: LoadGcodeInput): LoadedGcode => {
  if (!isBinaryGcode(bytes, fileName)) return { fileName, ...decodePlainText(bytes), binary: null, binaryError: null }
  try {
    const binary = decodeBgcode(bytes)
    return { fileName, text: binary.text, binary, binaryError: null, textEncoding: TextEncoding.UTF8 }
  } catch (error) {
    // Any failure inside the codec means the file is unreadable; the report says why (ADR-0007).
    return { fileName, text: '', binary: null, binaryError: error instanceof Error ? error.message : String(error), textEncoding: TextEncoding.UTF8 }
  }
}

/** Plain text that was never a file, for tests and callers that already hold a string. */
export const loadGcodeText = (fileName: string, text: string): LoadedGcode => ({ fileName, text, binary: null, binaryError: null, textEncoding: TextEncoding.UTF8 })
