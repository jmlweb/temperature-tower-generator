import { decodeBgcode, hasBgcodeMagic, utf8Decode, type BgcodeDocument } from './bgcode/index.ts'

/** An uploaded file after decoding: plain text, or binary G-code with its decoded text (ADR-0007). */
export interface LoadedGcode {
  readonly fileName: string
  /** G-code text the pipeline works on; empty when a binary file could not be decoded. */
  readonly text: string
  readonly binary: BgcodeDocument | null
  /** Why a file that looks binary could not be decoded; null otherwise. */
  readonly binaryError: string | null
}

export interface LoadGcodeInput {
  readonly fileName: string
  readonly bytes: Uint8Array
}

/** Binary G-code is recognised by the `.bgcode` extension or the `GCDE` magic. */
export const isBinaryGcode = (bytes: Uint8Array, fileName = ''): boolean => fileName.toLowerCase().endsWith('.bgcode') || hasBgcodeMagic(bytes)

export const loadGcodeFile = ({ fileName, bytes }: LoadGcodeInput): LoadedGcode => {
  if (!isBinaryGcode(bytes, fileName)) return { fileName, text: utf8Decode(bytes), binary: null, binaryError: null }
  try {
    const binary = decodeBgcode(bytes)
    return { fileName, text: binary.text, binary, binaryError: null }
  } catch (error) {
    // Any failure inside the codec means the file is unreadable; the report says why (ADR-0007).
    return { fileName, text: '', binary: null, binaryError: error instanceof Error ? error.message : String(error) }
  }
}

/** Plain text that was never a file, for tests and callers that already hold a string. */
export const loadGcodeText = (fileName: string, text: string): LoadedGcode => ({ fileName, text, binary: null, binaryError: null })
