import { ConfigSource, MATERIAL_PRESETS, TOOL_VERSION, encodeTowerConfigName, findPreset, type ProcessResult, type TowerConfig } from '@temptower/core'
import { createConfigForm } from './config-form.ts'
import { createCounter } from './counter.ts'
import { el, replaceChildren } from './dom.ts'
import { downloadBlob } from './download.ts'
import { icon } from './icons.ts'
import { renderReport } from './report-view.ts'
import { createGcodeClient, createTowerClient, type InspectResult } from './worker-client.ts'
import './styles.css'

const counter = createCounter({ isProduction: import.meta.env.PROD, endpoint: import.meta.env.VITE_COUNTER_URL as string | undefined })
const gcode = createGcodeClient()
const tower = createTowerClient()

const configForm = createConfigForm(MATERIAL_PRESETS[0]!.config)

// Long enough to let someone finish typing a number before the transform re-runs.
const RERUN_DELAY_MS = 400

type StatusTone = 'info' | 'busy' | 'ok' | 'error'
const setStatus = (element: HTMLElement, tone: StatusTone, text: string): void => {
  element.className = tone === 'info' ? 'status' : `status ${tone}`
  element.textContent = text
}

const describeConfig = (config: TowerConfig): string =>
  `${findPreset(config.material).label}, ${config.startTemperature} to ${config.endTemperature} °C in ${config.step} °C steps, ${config.blockHeight} mm blocks on a ${config.baseHeight} mm base${config.waitForTemperature ? ', waiting at each tier' : ''}`

type StepState = 'ready' | 'active' | 'done' | 'waiting'
const step = (number: string, title: string, hint: string, state: StepState, ...content: (Node | null)[]): HTMLElement =>
  el(
    'section',
    { class: 'step', 'data-state': state, 'aria-labelledby': `step-${number}` },
    el('div', { class: 'step-header' }, el('span', { class: 'step-number', 'aria-hidden': 'true' }, number), el('h2', { id: `step-${number}` }, title), el('span', { class: 'step-hint' }, hint)),
    ...content,
  )

// Step 1: tower STL
const stlStatus = el('p', { class: 'status', role: 'status' })
const generateButton = el('button', { type: 'button' }, icon('cube'), 'Generate tower STL')
generateButton.addEventListener('click', async () => {
  const problems = configForm.problems()
  if (problems.length > 0) {
    setStatus(stlStatus, 'error', `Fix the config first: ${problems.join('; ')}`)
    return
  }
  generateButton.disabled = true
  setStatus(stlStatus, 'busy', 'Building the tower in a worker (loads the CSG engine on first use)…')
  try {
    const built = await tower.build(configForm.getConfig())
    downloadBlob(built.stl, built.fileName, 'model/stl')
    setStatus(stlStatus, 'ok', `Downloaded ${built.fileName} (${built.triangles} triangles). Slice it as described in step 2.`)
    stepOne.dataset['state'] = 'done'
    stepTwo.dataset['state'] = 'active'
  } catch (error) {
    setStatus(stlStatus, 'error', `Could not build the tower: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    generateButton.disabled = false
  }
})

// Step 2: G-code upload and config recovery
const sliceSteps = el(
  'ol',
  { class: 'slice-steps' },
  el('li', {}, 'Open the STL in PrusaSlicer. Do not scale or rotate it.'),
  el('li', {}, 'Slice it with your usual printer, filament and print profiles.'),
  el('li', {}, 'Export the G-code, plain or binary, and drop it below.'),
)
const supportNote = el('p', { class: 'step-note' }, 'Works with Marlin, Prusa and Klipper firmware, with or without arc fitting.')
const fileInput = el('input', { type: 'file', accept: '.gcode,.g,.gco,.bgcode', id: 'gcode-file' })
const fileChip = el('span', { class: 'file-chip' })
const browseButton = el('button', { type: 'button', class: 'secondary' }, 'Browse files')
browseButton.addEventListener('click', () => fileInput.click())
const dropzoneTitle = el('span', { class: 'dropzone-title' }, 'Drop your sliced G-code here')
const dropzone = el(
  'div',
  { class: 'dropzone' },
  el('span', { class: 'dropzone-icon' }, icon('upload')),
  dropzoneTitle,
  el('span', { class: 'dropzone-formats' }, '.gcode or .bgcode, exported from PrusaSlicer'),
  browseButton,
  fileInput,
  fileChip,
)
const recoveryNotice = el('div', { class: 'notice', role: 'status' })
const uploadStatus = el('p', { class: 'status', role: 'status' })
const reportContainer = el('div', {})
const downloadContainer = el('div', { class: 'actions' })
const reportPlaceholder = el(
  'div',
  { class: 'placeholder' },
  el('p', {}, 'The report appears here as soon as a G-code file is loaded. It shows:'),
  el(
    'ul',
    {},
    el('li', {}, 'the slicer, base temperature and layer heights'),
    el('li', {}, 'every tier boundary with its temperature'),
    el('li', {}, 'each inserted and neutralized line'),
  ),
  el('p', {}, 'Download unlocks only when the report has no errors.'),
)

let loadedFileName: string | null = null
let lastResult: ProcessResult | null = null
// Bumped whenever a pending transform result becomes stale, so only the latest run renders.
let runId = 0
let rerunTimer: ReturnType<typeof setTimeout> | undefined

const sourceLabel = (source: ConfigSource): string => (source === ConfigSource.FILENAME ? 'the file name' : 'the object label in the G-code')

const describeRecovery = ({ inspection, input, binaryError }: InspectResult, isConfigChanged: boolean): string => {
  if (binaryError !== null) return `This binary G-code (.bgcode) could not be decoded: ${binaryError}. Re-export the file from PrusaSlicer.`
  const format = input.format === 'binary' ? ` Binary G-code decoded (${input.binary?.gcodeEncoding ?? 'unknown'} encoding, ${input.binary?.gcodeCompression ?? 'none'} compression); the download will be .bgcode too.` : ''
  const slicer = `${inspection.slicer.slicer === 'unknown' ? 'Slicer not recognised.' : `Sliced by ${inspection.slicer.slicer} ${inspection.slicer.version ?? ''}.`}${format}`
  if (!inspection.recovered) return `${slicer} No tower config found in the file name or object label: check that step 1 matches the STL you printed.`
  const source = sourceLabel(inspection.recovered.source)
  return isConfigChanged ? `${slicer} Tower config recovered from ${source}.` : `${slicer} The tower config in ${source} matches step 1.`
}

const showRecoveryNotice = (recovered: TowerConfig, source: ConfigSource, previous: TowerConfig): void => {
  const undoButton = el('button', { type: 'button', class: 'secondary small' }, 'Keep my previous values')
  undoButton.addEventListener('click', () => {
    replaceChildren(recoveryNotice)
    configForm.setConfig(previous)
  })
  replaceChildren(recoveryNotice, el('span', {}, `Step 1 now uses the config from ${sourceLabel(source)}: `, el('strong', {}, describeConfig(recovered)), '.'), undoButton)
}

const resetReport = (): void => {
  runId += 1
  lastResult = null
  replaceChildren(reportContainer, reportPlaceholder)
  replaceChildren(downloadContainer)
  stepThree.dataset['state'] = 'waiting'
}

// Step 3: report, then download (ADR-0004: the download control exists only after the report renders)
const showResult = (result: ProcessResult): void => {
  lastResult = result
  replaceChildren(reportContainer, renderReport(result.report))
  replaceChildren(downloadContainer)
  stepThree.dataset['state'] = 'active'
  if (result.outputBytes === null || !result.report.canDownload) {
    downloadContainer.append(el('p', { class: 'status error' }, 'Errors block the download. Fix the input and upload it again.'))
    return
  }
  const output = result.outputBytes
  const isBinary = result.report.input.format === 'binary'
  const downloadButton = el('button', { type: 'button' }, icon('download'), isBinary ? 'Download binary G-code' : 'Download G-code')
  downloadButton.addEventListener('click', () => {
    downloadBlob(output.slice(), result.outputFileName, isBinary ? 'application/octet-stream' : 'text/x-gcode')
    counter.recordProcessed()
    stepThree.dataset['state'] = 'done'
  })
  downloadContainer.append(
    el('div', { class: 'download-ready' }, downloadButton, el('span', { class: 'muted' }, el('code', {}, result.outputFileName), el('br', {}), 'Check the report above before printing.')),
  )
}

const runTransform = async ({ shouldScroll }: { shouldScroll: boolean }): Promise<void> => {
  if (!loadedFileName) return
  resetReport()
  const problems = configForm.problems()
  if (problems.length > 0) {
    setStatus(uploadStatus, 'error', `Fix the config first: ${problems.join('; ')}`)
    return
  }
  const current = runId
  setStatus(uploadStatus, 'busy', 'Transforming in a worker…')
  try {
    const result = await gcode.process(configForm.getConfig())
    if (current !== runId) return
    if (result.report.canDownload) {
      setStatus(uploadStatus, 'ok', `Report ready: ${result.report.inserted.length} tier commands inserted, ${result.report.neutralized.length} neutralized, ${result.report.warnings.length} warnings.`)
      stepTwo.dataset['state'] = 'done'
    } else {
      setStatus(uploadStatus, 'error', `Report ready: ${result.report.errors.length} errors block the download.`)
    }
    showResult(result)
    if (shouldScroll) stepThree.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (error) {
    if (current !== runId) return
    setStatus(uploadStatus, 'error', `Transform failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const loadFile = async (file: File): Promise<void> => {
  // Cleared until inspection succeeds, so a config edit meanwhile cannot transform a half-loaded file.
  loadedFileName = null
  clearTimeout(rerunTimer)
  resetReport()
  replaceChildren(recoveryNotice)
  fileChip.textContent = file.name
  setStatus(uploadStatus, 'busy', `Reading ${file.name}…`)
  try {
    const inspected = await gcode.inspect(file.name, await file.arrayBuffer())
    const previous = configForm.getConfig()
    const recovered = inspected.inspection.recovered
    const isConfigChanged = recovered !== null && encodeTowerConfigName(recovered.config) !== encodeTowerConfigName(previous)
    if (recovered && isConfigChanged) {
      configForm.setConfig(recovered.config)
      showRecoveryNotice(recovered.config, recovered.source, previous)
    }
    setStatus(uploadStatus, inspected.binaryError === null ? 'ok' : 'info', describeRecovery(inspected, isConfigChanged))
    loadedFileName = file.name
    stepTwo.dataset['state'] = 'active'
    await runTransform({ shouldScroll: true })
  } catch (error) {
    setStatus(uploadStatus, 'error', `Could not read the file: ${error instanceof Error ? error.message : String(error)}`)
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (file) void loadFile(file)
})
const setDropActive = (isActive: boolean): void => {
  dropzone.classList.toggle('active', isActive)
  dropzoneTitle.textContent = isActive ? 'Release to load the file' : 'Drop your sliced G-code here'
}
dropzone.addEventListener('dragover', (event) => {
  event.preventDefault()
  setDropActive(true)
})
dropzone.addEventListener('dragleave', (event) => {
  // dragleave also fires when moving onto a child element.
  if (!dropzone.contains(event.relatedTarget as Node | null)) setDropActive(false)
})
dropzone.addEventListener('drop', (event) => {
  event.preventDefault()
  setDropActive(false)
  const file = event.dataTransfer?.files[0]
  if (file) void loadFile(file)
})

configForm.onChange(() => {
  if (!loadedFileName) return
  // A config edit invalidates the previous report and its download at once; the new one follows shortly.
  if (lastResult) resetReport()
  clearTimeout(rerunTimer)
  rerunTimer = setTimeout(() => void runTransform({ shouldScroll: false }), RERUN_DELAY_MS)
})

const stepOne = step('1', 'Configure the tower and download the STL', 'Downloads an STL', 'active', configForm.element, el('div', { class: 'actions' }, generateButton), stlStatus)
const stepTwo = step('2', 'Slice it and upload the G-code', 'Plain or binary G-code', 'ready', sliceSteps, dropzone, recoveryNotice, uploadStatus, supportNote)
const stepThree = step('3', 'Review the changes and download', 'Download unlocks after review', 'waiting', reportContainer, downloadContainer)
resetReport()

const app = document.getElementById('app')!
app.append(
  el(
    'main',
    {},
    el(
      'header',
      { class: 'hero' },
      el('div', { class: 'brand' }, el('span', { class: 'brand-mark' }, icon('cube')), 'Temperature Tower Generator'),
      el('h1', {}, 'Dial in a new filament with a tower sliced by your own PrusaSlicer profile.'),
      el('p', { class: 'lead' }, 'Generate a labelled tower, slice it the way you always do, then let this page rewrite the G-code with one temperature per tier. Every change is shown before you download.'),
      el(
        'div',
        { class: 'pills' },
        el('span', { class: 'pill' }, icon('shield'), 'Runs in your browser: files never leave your device'),
        el('span', { class: 'pill' }, 'Free, no account'),
        el('span', { class: 'pill' }, 'PrusaSlicer .gcode and .bgcode'),
      ),
    ),
    el('div', { class: 'steps' }, stepOne, stepTwo, stepThree),
    el('footer', {}, el('span', {}, `v${TOOL_VERSION}`), el('span', {}, 'Phase 1 supports PrusaSlicer only.')),
  ),
)
