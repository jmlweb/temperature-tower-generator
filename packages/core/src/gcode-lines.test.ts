import { describe, expect, it } from 'vitest'
import { parseGcode, parseGcodeLine } from './gcode-lines.ts'

describe('gcode line parser', () => {
  it('keeps raw text and line endings', () => {
    const lines = parseGcode('G1 X1\r\nG1 X2\n; c\nM104 S200')
    expect(lines.map((l) => [l.raw, l.ending])).toEqual([
      ['G1 X1', '\r\n'],
      ['G1 X2', '\n'],
      ['; c', '\n'],
      ['M104 S200', ''],
    ])
    expect(lines.map((l) => l.raw + l.ending).join('')).toBe('G1 X1\r\nG1 X2\n; c\nM104 S200')
  })

  it('parses codes, words and comments', () => {
    const line = parseGcodeLine('G1 X114.974 Y-95.775 E.8 F10800 ; travel', 0)
    expect(line.code).toBe('G1')
    expect(line.words).toEqual({ X: 114.974, Y: -95.775, E: 0.8, F: 10800 })
    expect(line.comment).toBe(' travel')
  })

  it('parses tool-indexed temperature commands and tool changes', () => {
    expect(parseGcodeLine('M104 T1 S215', 0).words).toEqual({ T: 1, S: 215 })
    expect(parseGcodeLine('T0', 0).code).toBe('T0')
    expect(parseGcodeLine('M862.3 P "MK3S"', 0).code).toBe('M862.3')
  })

  it('treats comments and blanks as non-commands', () => {
    expect(parseGcodeLine(';LAYER_CHANGE', 0).code).toBeNull()
    expect(parseGcodeLine('', 0).code).toBeNull()
    expect(parseGcodeLine('M486 Acube.stl', 0).words).toEqual({})
  })
})
