const SVG_NS = 'http://www.w3.org/2000/svg'

/** 24px stroke icons (Lucide-style paths), decorative unless a label is given. */
const PATHS = {
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 20h16',
  download: 'M12 4v12 M7 11l5 5 5-5 M4 20h16',
  cube: 'M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z M12 22V11.5 M4 6.5l8 5 8-5',
  alert: 'M12 9v4 M12 17h.01 M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  error: 'M12 2a10 10 0 110 20 10 10 0 010-20z M12 8v4 M12 16h.01',
  check: 'M20 6L9 17l-5-5',
  offline: 'M3 12a9 9 0 0118 0 9 9 0 01-18 0z M3 12h18 M12 3a14 14 0 010 18 M12 3a14 14 0 000 18',
} as const

export type IconName = keyof typeof PATHS

export const icon = (name: IconName, label?: string): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  if (label) {
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', label)
  } else {
    svg.setAttribute('aria-hidden', 'true')
  }
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', PATHS[name])
  svg.append(path)
  return svg
}
