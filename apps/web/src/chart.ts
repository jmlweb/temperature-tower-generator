import type { ChartPoint, TierPlacement } from '@temptower/core'

const SVG_NS = 'http://www.w3.org/2000/svg'
const WIDTH = 520
const HEIGHT = 300
const MARGIN = { top: 16, right: 24, bottom: 36, left: 52 }

const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] => {
  const element = document.createElementNS(SVG_NS, tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value))
  if (text !== undefined) element.textContent = text
  return element
}

/**
 * Temperature-vs-Z step chart: Z runs up the vertical axis like the print, the
 * nozzle temperature runs along the horizontal axis. Each tier is one step.
 */
export const renderChart = (points: readonly ChartPoint[], tiers: readonly TierPlacement[], maxZ: number): SVGSVGElement => {
  const svg = svgEl('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, class: 'chart', role: 'img', 'aria-label': 'Temperature versus height' })
  const temperatures = points.map((p) => p.temperature).filter((t): t is number => t !== null)
  if (temperatures.length === 0) return svg
  const minT = Math.min(...temperatures) - 5
  const maxT = Math.max(...temperatures) + 5
  const topZ = Math.max(maxZ, points.at(-1)?.z ?? 0)
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const x = (t: number) => MARGIN.left + ((t - minT) / (maxT - minT)) * plotWidth
  const y = (z: number) => MARGIN.top + plotHeight - (z / topZ) * plotHeight

  svg.append(svgEl('rect', { x: MARGIN.left, y: MARGIN.top, width: plotWidth, height: plotHeight, class: 'chart-plot' }))

  // Tier bands and their boundaries.
  tiers.forEach((tier, index) => {
    const next = tiers[index + 1]?.boundaryZ ?? topZ
    svg.append(svgEl('rect', { x: MARGIN.left, y: y(next), width: plotWidth, height: y(tier.boundaryZ) - y(next), class: `chart-band chart-band-${index % 2}` }))
    svg.append(svgEl('text', { x: MARGIN.left + 6, y: y(next) + 14, class: 'chart-tier-label' }, `tier ${tier.tier}: ${tier.temperature} °C at Z ≥ ${tier.boundaryZ} mm`))
  })

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

  // Axes.
  const tickCount = 5
  for (let i = 0; i <= tickCount; i += 1) {
    const t = Math.round(minT + ((maxT - minT) * i) / tickCount)
    svg.append(svgEl('text', { x: x(t), y: HEIGHT - MARGIN.bottom + 18, class: 'chart-axis', 'text-anchor': 'middle' }, `${t}`))
    const z = Math.round((topZ * i) / tickCount * 10) / 10
    svg.append(svgEl('text', { x: MARGIN.left - 8, y: y(z) + 4, class: 'chart-axis', 'text-anchor': 'end' }, `${z}`))
  }
  svg.append(svgEl('text', { x: MARGIN.left + plotWidth / 2, y: HEIGHT - 4, class: 'chart-axis', 'text-anchor': 'middle' }, 'nozzle temperature °C'))
  svg.append(svgEl('text', { x: 14, y: MARGIN.top + plotHeight / 2, class: 'chart-axis', 'text-anchor': 'middle', transform: `rotate(-90 14 ${MARGIN.top + plotHeight / 2})` }, 'Z mm'))
  return svg
}
