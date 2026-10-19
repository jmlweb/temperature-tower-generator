import {
  MATERIAL_PRESETS,
  Material,
  encodeTowerConfigName,
  findPreset,
  tierCount,
  temperaturesOutsidePreset,
  tierTemperatures,
  towerHeight,
  validateTowerConfig,
  type TowerConfig,
} from '@temptower/core'
import { el, replaceChildren } from './dom.ts'

export interface ConfigForm {
  readonly element: HTMLElement
  getConfig(): TowerConfig
  setConfig(config: TowerConfig): void
  /** Validation problems for the current values; empty when valid. */
  problems(): readonly string[]
  onChange(listener: (config: TowerConfig) => void): void
}

const numberInput = (name: string, label: string, unit: string, step: string, min: string) => {
  const input = el('input', { type: 'number', name, step, min, required: true, id: `config-${name}`, inputmode: 'decimal' })
  const wrapper = el('label', { class: 'field', for: `config-${name}` }, el('span', {}, label), el('span', { class: 'control' }, input, el('span', { class: 'unit' }, unit)))
  return { input, wrapper }
}

/** The single tower config form shared by STL generation and the G-code transform (ADR-0005). */
export const createConfigForm = (initial: TowerConfig): ConfigForm => {
  const listeners: ((config: TowerConfig) => void)[] = []
  const material = el('select', { name: 'material', id: 'config-material' }, ...MATERIAL_PRESETS.map((preset) => el('option', { value: preset.material }, preset.label)))
  const start = numberInput('startTemperature', 'Bottom tier', '°C', '1', '100')
  const end = numberInput('endTemperature', 'Top tier', '°C', '1', '100')
  const step = numberInput('step', 'Step', '°C', '1', '1')
  const blockHeight = numberInput('blockHeight', 'Block height', 'mm', '0.5', '6')
  const baseHeight = numberInput('baseHeight', 'Base height', 'mm', '0.1', '1')
  const wait = el('input', { type: 'checkbox', name: 'waitForTemperature', id: 'config-wait' })
  const preview = el('div', { class: 'preview', 'aria-live': 'polite' })
  const problems = el('ul', { class: 'problems', 'aria-live': 'polite' })

  const read = (): TowerConfig => ({
    material: material.value as Material,
    startTemperature: Number(start.input.value),
    endTemperature: Number(end.input.value),
    step: Number(step.input.value),
    blockHeight: Number(blockHeight.input.value),
    baseHeight: Number(baseHeight.input.value),
    waitForTemperature: wait.checked,
  })

  const render = (): void => {
    const config = read()
    const issues = validateTowerConfig(config)
    replaceChildren(problems, ...issues.map((issue) => el('li', {}, issue)))
    if (issues.length === 0) {
      const preset = findPreset(config.material)
      const temps = tierTemperatures(config)
      const hottest = Math.max(...temps)
      const coldest = Math.min(...temps)
      const heat = (t: number) => (hottest === coldest ? 0.5 : (t - coldest) / (hottest - coldest))
      const outside = new Set(temperaturesOutsidePreset(config))
      replaceChildren(
        preview,
        el(
          'div',
          { class: 'preview-stats' },
          el('span', {}, el('strong', {}, String(tierCount(config))), ' tiers'),
          el('span', {}, el('strong', {}, `${towerHeight(config)} mm`), ' tall'),
        ),
        el(
          'div',
          { class: 'tier-chips', 'aria-label': 'Tier temperatures from bottom to top' },
          el('span', { class: 'tier-end' }, 'Bottom'),
          ...temps.map((t) => el('span', { class: outside.has(t) ? 'tier-chip outside' : 'tier-chip', style: `--heat: ${heat(t).toFixed(2)}`, title: outside.has(t) ? `Outside the ${preset.label} range` : undefined }, `${t}°`)),
          el('span', { class: 'tier-end' }, 'Top'),
        ),
        // Break the long name only after underscores, never inside a value like `step5`.
        outside.size === 0
          ? null
          : el('p', { class: 'preview-warning', role: 'status' }, `${[...outside].join(', ')} °C ${outside.size === 1 ? 'is' : 'are'} outside the ${preset.label} range of ${preset.minTemperature}–${preset.maxTemperature} °C. The tower still generates; check your filament's datasheet.`),
        el('div', { class: 'preview-file' }, 'STL file name: ', el('code', {}, ...`${encodeTowerConfigName(config)}.stl`.split(/(?<=_)/).flatMap((part) => [part, el('wbr', {})]))),
      )
      preview.hidden = false
    } else {
      replaceChildren(preview)
      preview.hidden = true
    }
    for (const listener of listeners) listener(config)
  }

  const write = (config: TowerConfig): void => {
    material.value = config.material
    start.input.value = String(config.startTemperature)
    end.input.value = String(config.endTemperature)
    step.input.value = String(config.step)
    blockHeight.input.value = String(config.blockHeight)
    baseHeight.input.value = String(config.baseHeight)
    wait.checked = config.waitForTemperature
    render()
  }

  material.addEventListener('change', () => {
    // Switching preset loads its defaults; the user can still edit every field afterwards.
    write(findPreset(material.value as Material).config)
  })
  for (const input of [start.input, end.input, step.input, blockHeight.input, baseHeight.input, wait]) {
    input.addEventListener('input', render)
  }

  const element = el(
    'form',
    { class: 'config-form', onsubmit: (event: Event) => event.preventDefault() },
    el('label', { class: 'field field-material', for: 'config-material' }, el('span', {}, 'Material preset'), el('span', { class: 'control control-select' }, material)),
    start.wrapper,
    end.wrapper,
    step.wrapper,
    blockHeight.wrapper,
    baseHeight.wrapper,
    el(
      'label',
      { class: 'field field-switch', for: 'config-wait' },
      wait,
      el('span', { class: 'switch', 'aria-hidden': 'true' }),
      el('span', { class: 'switch-text' }, el('span', {}, 'Wait for temperature at each tier'), el('small', {}, 'Uses M109 R instead of M104, so each tier starts only once the nozzle has heated or cooled to its temperature.')),
    ),
    preview,
    problems,
  )

  write(initial)

  return {
    element,
    getConfig: read,
    setConfig: write,
    problems: () => validateTowerConfig(read()),
    onChange: (listener) => listeners.push(listener),
  }
}
