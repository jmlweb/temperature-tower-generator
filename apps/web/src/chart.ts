import type { ChartPoint, TierPlacement } from '@temptower/core'

const SVG_NS = 'http://www.w3.org/2000/svg'
const WIDTH = 640
const HEIGHT = 320
const MARGIN = { top: 12, right: 20, bottom: 40, left: 52 }
// Width of a "230 °C" tier label at the 11px chart font, with a little slack.
const LABEL_WIDTH = 42
const LABEL_GAP = 8
const MAX_TICKS = 6
const Z_TICK_STEPS = [1, 2, 5, 10, 20, 50, 100]

/** Multiples of `step` from `from` to `to`, inclusive. */
const ticksBetween = (from: number, to: number, step: number): readonly number[] =>
  Array.from({ length: Math.floor((to - from) / step + 1e-9) + 1 }, (_, i) => from + i * step)

const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] => {
  const element = document.createElementNS(SVG_NS, tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value))
  if (text !== undefined) element.textContent = text
  return element
}

/**
 * Temperature-vs-Z step chart: Z runs up the vertical axis like the print, the
 * nozzle temperature runs along the horizontal axis. Each tier is one step.
 * The temperature axis runs from tier 0 toward the last tier, so the steps
 * always read left to right; a cooling tower gets a hot-to-cold axis.
 * One series, so no legend; each tier band carries a hover tooltip.
 */
export const renderChart = (points: readonly ChartPoint[], tiers: readonly TierPlacement[], maxZ: number): SVGSVGElement => {
  const svg = svgEl('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, class: 'chart', role: 'img', 'aria-label': 'Nozzle temperature versus height' })
  const temperatures = points.map((p) => p.temperature).filter((t): t is number => t !== null)
  if (temperatures.length === 0) return svg
  // Ends snap to the tick step, so both axis ends carry a label and tiers on 5 °C multiples sit on grid lines.
  const temperatureStep = Math.max(...temperatures) - Math.min(...temperatures) + 10 <= 50 ? 5 : 10
  const minT = Math.floor((Math.min(...temperatures) - 5) / temperatureStep) * temperatureStep
  const maxT = Math.ceil((Math.max(...temperatures) + 5) / temperatureStep) * temperatureStep
  const topZ = Math.max(maxZ, points.at(-1)?.z ?? 0)
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const isCooling = tiers.length > 1 && tiers[0]!.temperature > tiers.at(-1)!.temperature
  const x = (t: number) => MARGIN.left + ((isCooling ? maxT - t : t - minT) / (maxT - minT)) * plotWidth
  const y = (z: number) => MARGIN.top + plotHeight - (z / topZ) * plotHeight

  // Tier bands and their boundaries.
  tiers.forEach((tier, index) => {
    const next = tiers[index + 1]?.startZ ?? topZ
    const band = svgEl('rect', { x: MARGIN.left, y: y(next), width: plotWidth, height: Math.max(0, y(tier.startZ) - y(next)), class: `chart-band chart-band-${index % 2}` })
    band.append(svgEl('title', {}, `Tier ${tier.tier}: ${tier.temperature} °C from Z ${tier.startZ} mm${tier.layerZ === null ? ' (not reached)' : ` (layer at ${tier.layerZ} mm)`}`))
    svg.append(band)
    if (y(tier.startZ) - y(next) >= 16) {
      // Beside the tier's vertical step: to its right when there is room, else to its left.
      const lineX = x(tier.temperature)
      const fitsRight = lineX + LABEL_GAP + LABEL_WIDTH <= MARGIN.left + plotWidth
      svg.append(
        svgEl('text', { x: fitsRight ? lineX + LABEL_GAP : lineX - LABEL_GAP, y: y(next) + 13, class: 'chart-tier-label', 'text-anchor': fitsRight ? 'start' : 'end' }, `${tier.temperature} °C`),
      )
    }
  })

  // Grid and axes.
  for (const t of ticksBetween(minT, maxT, temperatureStep)) {
    svg.append(svgEl('line', { x1: x(t), x2: x(t), y1: MARGIN.top, y2: MARGIN.top + plotHeight, class: 'chart-grid' }))
    svg.append(svgEl('text', { x: x(t), y: HEIGHT - MARGIN.bottom + 18, class: 'chart-axis', 'text-anchor': 'middle' }, `${t}`))
  }
  const zStep = Z_TICK_STEPS.find((step) => topZ / step <= MAX_TICKS) ?? Z_TICK_STEPS.at(-1)!
  for (const z of ticksBetween(0, topZ, zStep)) {
    svg.append(svgEl('text', { x: MARGIN.left - 8, y: y(z) + 4, class: 'chart-axis', 'text-anchor': 'end' }, `${z}`))
  }
  svg.append(svgEl('rect', { x: MARGIN.left, y: MARGIN.top, width: plotWidth, height: plotHeight, class: 'chart-plot' }))
  svg.append(svgEl('text', { x: MARGIN.left + plotWidth / 2, y: HEIGHT - 6, class: 'chart-axis', 'text-anchor': 'middle' }, 'nozzle temperature °C'))
  svg.append(svgEl('text', { x: 14, y: MARGIN.top + plotHeight / 2, class: 'chart-axis', 'text-anchor': 'middle', transform: `rotate(-90 14 ${MARGIN.top + plotHeight / 2})` }, 'Z mm'))

  // Step line: hold each temperature until the next boundary.
  let path = ''
  let previous: number | null = null
  for (const point of points) {
    if (point.temperature === null) continue
    if (previous === null) path += `M ${x(point.temperature)} ${y(point.z)}`
    else path += ` L ${x(previous)} ${y(point.z)} L ${x(point.temperature)} ${y(point.z)}`
    previous = point.temperature
  }
  svg.append(svgEl('path', { d: path, class: 'chart-line' }))
  for (const tier of tiers) {
    if (tier.layerZ === null) continue
    svg.append(svgEl('circle', { cx: x(tier.temperature), cy: y(tier.layerZ), r: 4, class: 'chart-dot' }))
  }
  return svg
}
