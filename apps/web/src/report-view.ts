import type { Report } from '@temptower/core'
import { renderChart } from './chart.ts'
import { el } from './dom.ts'
import { icon } from './icons.ts'

const issueList = (title: string, issues: Report['errors'], className: 'errors' | 'warnings'): HTMLElement | null =>
  issues.length === 0
    ? null
    : el(
        'section',
        { class: `issues ${className}` },
        icon(className === 'errors' ? 'error' : 'alert'),
        el('h3', {}, title),
        el('ul', {}, ...issues.map((issue) => el('li', {}, el('code', {}, issue.code), ` ${issue.message}`))),
      )

const lineList = (title: string, lines: readonly { lineNumber: number; text: string }[], empty: string): HTMLElement =>
  el(
    'details',
    { class: 'lines', open: true },
    el('summary', {}, title, el('span', { class: 'count' }, String(lines.length))),
    lines.length === 0
      ? el('p', { class: 'muted' }, empty)
      : el('ol', {}, ...lines.map((line) => el('li', {}, el('span', { class: 'line-number' }, String(line.lineNumber)), el('code', {}, line.text)))),
  )

const fact = (label: string, value: string, detail?: string): HTMLElement =>
  el('div', { class: 'fact' }, el('dt', {}, label), el('dd', {}, value, detail ? el('small', {}, detail) : null))

/** Binary inputs show how they were encoded, so a firmware complaint can be traced (ADR-0007). */
const describeInput = (input: Report['input']): { value: string; detail?: string } => {
  if (input.format === 'text') return { value: 'Plain G-code' }
  if (input.binary === null) return { value: 'Binary G-code (.bgcode)', detail: 'not decoded' }
  const { version, checksum, gcodeCompression, gcodeEncoding, gcodeBlocks, thumbnails } = input.binary
  return {
    value: `Binary G-code v${version}`,
    detail: `${checksum} checksums, ${gcodeBlocks} G-code blocks (${gcodeEncoding}, ${gcodeCompression}), ${thumbnails} thumbnails. Output is .bgcode.`,
  }
}

/** Everything ADR-0004 asks the user to see before downloading. */
export const renderReport = (report: Report): HTMLElement => {
  const baseSource = {
    'slicer-config': 'from the slicer config block',
    'start-gcode': 'from the first temperature command in the start G-code',
    unknown: 'not found',
  }[report.baseTemperature.source]
  const input = describeInput(report.input)

  return el(
    'div',
    { class: 'report' },
    el(
      'dl',
      { class: 'facts' },
      fact('File', report.fileName),
      fact('Slicer', report.slicer.name === 'unknown' ? 'Not recognised' : `${report.slicer.name} ${report.slicer.version ?? ''}`, report.slicer.name === 'unknown' ? 'Phase 1 supports PrusaSlicer' : undefined),
      fact('Input', input.value, input.detail),
      fact('Base temperature', report.baseTemperature.value === null ? 'Not found' : `${report.baseTemperature.value} °C`, baseSource),
      fact('Layers', `${report.layers.count} × ${report.layers.typicalHeight} mm`, `top at ${report.layers.maxZ} mm, expected ${report.layers.expectedHeight} mm`),
      fact('Tower config', report.configName),
    ),
    issueList('Errors block the download', report.errors, 'errors'),
    issueList('Warnings', report.warnings, 'warnings'),
    report.tiers.length > 0 ? el('div', { class: 'chart-wrap' }, el('div', { class: 'chart-title' }, 'Nozzle temperature along the print'), el('div', { class: 'chart-scroll' }, renderChart(report.chart, report.tiers, report.layers.maxZ))) : null,
    report.tiers.length > 0
      ? el(
          'div',
          { class: 'table-wrap' },
          el(
            'table',
            { class: 'tiers' },
            el('thead', {}, el('tr', {}, el('th', {}, 'Tier'), el('th', { class: 'num' }, 'Temperature'), el('th', { class: 'num' }, 'Boundary Z'), el('th', { class: 'num' }, 'Layer Z'), el('th', { class: 'num' }, 'Line'))),
            el(
              'tbody',
              {},
              ...report.tiers.map((tier) =>
                el(
                  'tr',
                  {},
                  el('td', {}, String(tier.tier)),
                  el('td', { class: 'num' }, `${tier.temperature} °C`),
                  el('td', { class: 'num' }, `${tier.boundaryZ} mm`),
                  el('td', { class: 'num' }, tier.layerZ === null ? 'not reached' : `${tier.layerZ} mm`),
                  el('td', { class: 'num' }, tier.lineIndex === null ? '–' : String(tier.lineIndex + 1)),
                ),
              ),
            ),
          ),
        )
      : null,
    report.canDownload ? lineList('Inserted commands', report.inserted, 'Nothing inserted.') : null,
    report.canDownload ? lineList('Neutralized commands', report.neutralized, 'No temperature commands needed neutralizing.') : null,
  )
}
