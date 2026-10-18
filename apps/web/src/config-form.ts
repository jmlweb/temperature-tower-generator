import {
  MATERIAL_PRESETS,
  Material,
  encodeTowerConfigName,
  findPreset,
  tierCount,
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

const numberInput = (name: string, label: string, step: string, min: string) => {
  const input = el('input', { type: 'number', name, step, min, required: true, id: `config-${name}` })
  const wrapper = el('label', { class: 'field', for: `config-${name}` }, el('span', {}, label), input)
  return { input, wrapper }
}

/** The single tower config form shared by STL generation and the G-code transform (ADR-0005). */
export const createConfigForm = (initial: TowerConfig): ConfigForm => {
  const listeners: ((config: TowerConfig) => void)[] = []
  const material = el('select', { name: 'material', id: 'config-material' }, ...MATERIAL_PRESETS.map((preset) => el('option', { value: preset.material }, preset.label)))
  const start = numberInput('startTemperature', 'Bottom tier °C', '1', '100')
  const end = numberInput('endTemperature', 'Top tier °C', '1', '100')
  const step = numberInput('step', 'Step °C', '1', '1')
  const blockHeight = numberInput('blockHeight', 'Block height mm', '0.5', '6')
  const baseHeight = numberInput('baseHeight', 'Base height mm', '0.5', '1')
  const wait = el('input', { type: 'checkbox', name: 'waitForTemperature', id: 'config-wait' })
  const summary = el('p', { class: 'summary', 'aria-live': 'polite' })
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
      replaceChildren(
        summary,
        `${tierCount(config)} tiers (${temps.join(', ')} °C), ${towerHeight(config)} mm tall. `,
        `Preset range ${preset.minTemperature}–${preset.maxTemperature} °C. `,
        el('code', {}, `${encodeTowerConfigName(config)}.stl`),
      )
    } else {
      replaceChildren(summary)
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
    el('label', { class: 'field', for: 'config-material' }, el('span', {}, 'Material preset'), material),
    start.wrapper,
    end.wrapper,
    step.wrapper,
    blockHeight.wrapper,
    baseHeight.wrapper,
    el('label', { class: 'field field-checkbox', for: 'config-wait' }, wait, el('span', {}, 'Wait for temperature at each tier (M109 instead of M104)')),
    summary,
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
