/**
 * 5x7 bitmap digits. Each glyph is 7 rows (top first) of 5 columns; `#` is a
 * filled cell. Only digits are needed for temperature labels.
 */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
}

export const GLYPH_COLUMNS = 5
export const GLYPH_ROWS = 7
export const GLYPH_GAP = 1

export interface GlyphCell {
  readonly column: number
  readonly row: number
}

export const textColumns = (text: string): number => text.length * GLYPH_COLUMNS + (text.length - 1) * GLYPH_GAP

/** Filled cells of `text` laid out left to right, row 0 at the top. */
export const textCells = (text: string): readonly GlyphCell[] => {
  const cells: GlyphCell[] = []
  for (const [index, character] of [...text].entries()) {
    const glyph = GLYPHS[character]
    if (!glyph) throw new Error(`No glyph for character "${character}"`)
    const offset = index * (GLYPH_COLUMNS + GLYPH_GAP)
    glyph.forEach((rowText, row) => {
      for (let column = 0; column < GLYPH_COLUMNS; column += 1) {
        if (rowText[column] === '#') cells.push({ column: offset + column, row })
      }
    })
  }
  return cells
}

/** Renders `text` as rows of `#`/`.` so a mesh raster can be compared to it. */
export const textBitmap = (text: string): readonly string[] => {
  const columns = textColumns(text)
  const rows = Array.from({ length: GLYPH_ROWS }, () => Array.from({ length: columns }, () => '.'))
  for (const cell of textCells(text)) rows[cell.row]![cell.column] = '#'
  return rows.map((row) => row.join(''))
}
