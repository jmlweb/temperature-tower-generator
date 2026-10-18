import type { Report } from '@temptower/core'
import { renderChart } from './chart.ts'
import { el } from './dom.ts'

const issueList = (title: string, issues: Report['errors'], className: string): HTMLElement | null =>
  issues.length === 0
    ? null
    : el('section', { class: `issues ${className}` }, el('h3', {}, title), el('ul', {}, ...issues.map((issue) => el('li', {}, el('code', {}, issue.code), ` ${issue.message}`))))

const lineList = (title: string, lines: readonly { lineNumber: number; text: string }[], empty: string): HTMLElement =>
  el(
    'details',
    { class: 'lines', open: true },
    el('summary', {}, `${title} (${lines.length})`),
    lines.length === 0
      ? el('p', { class: 'muted' }, empty)
      : el('ol', {}, ...lines.map((line) => el('li', { value: String(line.lineNumber) }, el('code', {}, line.text)))),
  )

/** Everything ADR-0004 asks the user to see before downloading. */
export const renderReport = (report: Report): HTMLElement => {
  const baseSource = {
    'slicer-config': 'from the slicer config block',
    'start-gcode': 'from the first temperature command in the start G-code',
    unknown: 'not found',
  }[report.baseTemperature.source]

  return el(
    'div',
    { class: 'report' },
    el(
      'dl',
      { class: 'facts' },
      el('dt', {}, 'File'),
      el('dd', {}, report.fileName),
      el('dt', {}, 'Slicer'),
      el('dd', {}, report.slicer.name === 'unknown' ? 'not recognised (Phase 1 supports PrusaSlicer)' : `${report.slicer.name} ${report.slicer.version ?? ''}`),
      el('dt', {}, 'Base temperature'),
      el('dd', {}, report.baseTemperature.value === null ? baseSource : `${report.baseTemperature.value} °C, ${baseSource}`),
      el('dt', {}, 'Layers'),
      el('dd', {}, `${report.layers.count} layers of ${report.layers.typicalHeight} mm, top at ${report.layers.maxZ} mm (expected ${report.layers.expectedHeight} mm)`),
      el('dt', {}, 'Tower config'),
      el('dd', {}, el('code', {}, report.configName)),
    ),
    issueList('Errors (download blocked)', report.errors, 'errors'),
    issueList('Warnings', report.warnings, 'warnings'),
    report.tiers.length > 0 ? renderChart(report.chart, report.tiers, report.layers.maxZ) : null,
    report.tiers.length > 0
      ? el(
          'table',
          { class: 'tiers' },
          el('thead', {}, el('tr', {}, el('th', {}, 'Tier'), el('th', {}, '°C'), el('th', {}, 'Boundary Z'), el('th', {}, 'Layer Z'), el('th', {}, 'Line'))),
          el(
            'tbody',
            {},
            ...report.tiers.map((tier) =>
              el(
                'tr',
                {},
                el('td', {}, String(tier.tier)),
                el('td', {}, String(tier.temperature)),
                el('td', {}, `${tier.boundaryZ}`),
                el('td', {}, tier.layerZ === null ? 'not reached' : `${tier.layerZ}`),
                el('td', {}, tier.lineIndex === null ? '–' : String(tier.lineIndex + 1)),
              ),
            ),
          ),
        )
      : null,
    report.canDownload ? lineList('Inserted commands', report.inserted, 'Nothing inserted.') : null,
    report.canDownload ? lineList('Neutralized commands', report.neutralized, 'No temperature commands needed neutralizing.') : null,
  )
}
