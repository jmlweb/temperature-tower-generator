/**
 * A G-code line parsed as a stream, keeping its raw text and line ending so the
 * transform can emit untouched lines byte-for-byte (ADR-0002).
 */
export interface GcodeLine {
  readonly index: number
  /** Line text without its line ending. */
  readonly raw: string
  /** `\n`, `\r\n` or `` for the last line without a terminator. */
  readonly ending: string
  /** Command code such as `G1`, `M104`, `T0`, or null for comments and blanks. */
  readonly code: string | null
  /** Numeric words keyed by letter, e.g. `{ X: 10, E: 0.5 }`. */
  readonly words: Readonly<Record<string, number>>
  /** Text after `;`, without the semicolon, or null. */
  readonly comment: string | null
}

const CODE_PATTERN = /^\s*([GMT])(\d+(?:\.\d+)?)/i
const WORD_PATTERN = /([A-Z])\s*([-+]?(?:\d+\.?\d*|\.\d+))/gi

export const parseGcodeLine = (raw: string, index: number): GcodeLine => {
  const semicolon = raw.indexOf(';')
  const command = semicolon === -1 ? raw : raw.slice(0, semicolon)
  const comment = semicolon === -1 ? null : raw.slice(semicolon + 1)
  const codeMatch = CODE_PATTERN.exec(command)
  if (!codeMatch) return { index, raw, ending: '', code: null, words: {}, comment }
  const code = `${codeMatch[1]!.toUpperCase()}${codeMatch[2]}`
  const words: Record<string, number> = {}
  const rest = command.slice(codeMatch[0].length)
  for (const match of rest.matchAll(WORD_PATTERN)) {
    words[match[1]!.toUpperCase()] = Number(match[2])
  }
  return { index, raw, ending: '', code, words, comment }
}

/** Splits text into lines, keeping each line's own ending. */
export const parseGcode = (text: string): readonly GcodeLine[] => {
  const lines: GcodeLine[] = []
  let start = 0
  let index = 0
  while (start < text.length) {
    let end = text.indexOf('\n', start)
    let ending: string
    let rawEnd: number
    if (end === -1) {
      end = text.length
      rawEnd = end
      ending = ''
    } else if (end > start && text.charCodeAt(end - 1) === 13) {
      rawEnd = end - 1
      ending = '\r\n'
    } else {
      rawEnd = end
      ending = '\n'
    }
    const parsed = parseGcodeLine(text.slice(start, rawEnd), index)
    lines.push({ ...parsed, ending })
    index += 1
    start = end + 1
  }
  return lines
}

export const isTemperatureCommand = (line: GcodeLine): boolean => line.code === 'M104' || line.code === 'M109'
