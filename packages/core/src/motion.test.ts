import { describe, expect, it } from 'vitest'
import { parseGcode } from './gcode-lines.ts'
import { analyzeMotion, typicalLayerHeight } from './motion.ts'

const analyze = (text: string) => analyzeMotion(parseGcode(text))

describe('motion-derived layers', () => {
  it('starts a layer at the first extruding move above the current Z', () => {
    const motion = analyze(['G90', 'M83', 'G1 Z0.2', 'G1 X10 Y0 E1', 'G1 Z0.4', 'G1 X20 Y0', 'G1 X0 Y0 E1'].join('\n'))
    expect(motion.layers.map((l) => [l.z, l.firstLineIndex])).toEqual([
      [0.2, 3],
      [0.4, 6],
    ])
    expect(motion.layers[1]?.height).toBe(0.2)
  })

  it('ignores a Z-hop that returns before extruding', () => {
    const motion = analyze(['G90', 'M83', 'G1 Z0.2', 'G1 X10 E1', 'G1 Z0.8', 'G1 X20', 'G1 Z0.2', 'G1 X0 E1', 'G1 Z0.4', 'G1 X5 E1'].join('\n'))
    expect(motion.layers.map((l) => l.z)).toEqual([0.2, 0.4])
  })

  it('handles relative extrusion, absolute extrusion and G92 E0', () => {
    const relative = analyze(['M83', 'G1 Z0.2', 'G1 X1 E0.5', 'G1 Z0.4', 'G1 X2 E0.5'].join('\n'))
    expect(relative.layers.map((l) => l.z)).toEqual([0.2, 0.4])
    const absolute = analyze(['M82', 'G1 Z0.2', 'G1 X1 E0.5', 'G92 E0', 'G1 Z0.4', 'G1 X2 E0.3', 'G1 Z0.6', 'G1 X3 E0.2'].join('\n'))
    expect(absolute.layers.map((l) => l.z)).toEqual([0.2, 0.4])
    expect(absolute.hasExtrusion).toBe(true)
  })

  it('does not count retractions or pure E moves as extrusion', () => {
    const motion = analyze(['M83', 'G1 Z0.2', 'G1 E-0.8', 'G1 E0.8', 'G1 X5 E-0.1'].join('\n'))
    expect(motion.layers).toEqual([])
    expect(motion.hasExtrusion).toBe(false)
  })

  it('supports relative positioning for Z', () => {
    const motion = analyze(['G91', 'M83', 'G1 Z0.2', 'G1 X1 E1', 'G1 Z0.2', 'G1 X1 E1'].join('\n'))
    expect(motion.layers.map((l) => l.z)).toEqual([0.2, 0.4])
  })

  it('records arcs, tools and temperature lines with their layer Z', () => {
    const motion = analyze(['M104 S215', 'M83', 'G1 Z0.2', 'G1 X1 E1', 'G2 X2 Y1 I1 E0.5', 'T1', 'T0', 'M109 T0 S220', 'G1 Z0.4', 'G1 X3 E1', 'M104 S0'].join('\n'))
    expect(motion.arcLineIndexes).toEqual([4])
    expect(motion.toolsUsed).toEqual([0, 1])
    expect(motion.temperatureLines).toEqual([
      { lineIndex: 0, code: 'M104', target: 215, tool: null, layerZ: Number.NEGATIVE_INFINITY },
      { lineIndex: 7, code: 'M109', target: 220, tool: 0, layerZ: 0.2 },
      { lineIndex: 10, code: 'M104', target: 0, tool: null, layerZ: 0.4 },
    ])
  })

  it('flags descending layers and finds the typical height', () => {
    const motion = analyze(['M83', 'G1 Z0.2', 'G1 X1 E1', 'G1 Z0.4', 'G1 X2 E1', 'G1 Z0.6', 'G1 X3 E1', 'G1 Z0.2', 'G1 X4 E1'].join('\n'))
    expect(motion.layers.map((l) => l.descending)).toEqual([false, false, false, true])
    expect(typicalLayerHeight(motion.layers)).toBe(0.2)
    expect(motion.maxLayerZ).toBe(0.6)
  })
})
