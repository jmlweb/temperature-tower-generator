import { ConfigSource, MATERIAL_PRESETS, TOOL_VERSION, type ProcessResult, type TowerConfig } from '@temptower/core'
import { createConfigForm } from './config-form.ts'
import { createCounter } from './counter.ts'
import { el, replaceChildren } from './dom.ts'
import { downloadBlob } from './download.ts'
import { renderReport } from './report-view.ts'
import { createGcodeClient, createTowerClient, type InspectResult } from './worker-client.ts'
import './styles.css'

const counter = createCounter({ isProduction: import.meta.env.PROD, endpoint: import.meta.env.VITE_COUNTER_URL as string | undefined })
const gcode = createGcodeClient()
const tower = createTowerClient()

const configForm = createConfigForm(MATERIAL_PRESETS[0]!.config)

// Step 1: tower STL
const stlStatus = el('p', { class: 'status' })
const generateButton = el('button', { type: 'button' }, 'Generate tower STL')
generateButton.addEventListener('click', async () => {
  const problems = configForm.problems()
  if (problems.length > 0) {
    stlStatus.textContent = `Fix the config first: ${problems.join('; ')}`
    return
  }
  generateButton.disabled = true
  stlStatus.textContent = 'Building the tower in a worker (loads the CSG engine on first use)…'
  try {
    const built = await tower.build(configForm.getConfig())
    downloadBlob(built.stl, built.fileName, 'model/stl')
    stlStatus.textContent = `Downloaded ${built.fileName} (${built.triangles} triangles). Slice it in PrusaSlicer without scaling, then upload the G-code below.`
  } catch (error) {
    stlStatus.className = 'status error'
    stlStatus.textContent = `Could not build the tower: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    generateButton.disabled = false
  }
})

// Step 2: G-code upload and config recovery
const fileInput = el('input', { type: 'file', accept: '.gcode,.g,.gco,.bgcode', id: 'gcode-file' })
const dropzone = el('div', { class: 'dropzone' }, el('label', { for: 'gcode-file' }, 'Drop your sliced G-code here or '), fileInput)
const uploadStatus = el('p', { class: 'status' })
const transformButton = el('button', { type: 'button', disabled: true }, 'Transform G-code')
const reportContainer = el('div', {})
const downloadContainer = el('div', { class: 'actions' })

let loadedFileName: string | null = null
let lastResult: ProcessResult | null = null

const describeRecovery = ({ inspection, input, binaryError }: InspectResult): string => {
  if (binaryError !== null) return `This binary G-code (.bgcode) could not be decoded: ${binaryError}. Transform to see the report, or re-export the file.`
  const format = input.format === 'binary' ? ` Binary G-code decoded (${input.binary?.gcodeEncoding ?? 'unknown'} encoding, ${input.binary?.gcodeCompression ?? 'none'} compression); the download will be .bgcode too.` : ''
  const slicer = `${inspection.slicer.slicer === 'unknown' ? 'Slicer not recognised.' : `Sliced by ${inspection.slicer.slicer} ${inspection.slicer.version ?? ''}.`}${format}`
  if (!inspection.recovered) return `${slicer} No tower config found in the file name or object label: check the config above matches the STL you printed, then transform.`
  const source = inspection.recovered.source === ConfigSource.FILENAME ? 'the file name' : 'the object label in the G-code'
  return `${slicer} Tower config recovered from ${source} and loaded into the form above.`
}

const loadFile = async (file: File): Promise<void> => {
  loadedFileName = file.name
  lastResult = null
  replaceChildren(reportContainer)
  replaceChildren(downloadContainer)
  transformButton.disabled = true
  uploadStatus.className = 'status'
  uploadStatus.textContent = `Reading ${file.name}…`
  try {
    const inspected = await gcode.inspect(file.name, await file.arrayBuffer())
    if (inspected.inspection.recovered) configForm.setConfig(inspected.inspection.recovered.config)
    uploadStatus.textContent = describeRecovery(inspected)
    transformButton.disabled = false
  } catch (error) {
    uploadStatus.className = 'status error'
    uploadStatus.textContent = `Could not read the file: ${error instanceof Error ? error.message : String(error)}`
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (file) void loadFile(file)
})
dropzone.addEventListener('dragover', (event) => {
  event.preventDefault()
  dropzone.classList.add('active')
})
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('active'))
dropzone.addEventListener('drop', (event) => {
  event.preventDefault()
  dropzone.classList.remove('active')
  const file = event.dataTransfer?.files[0]
  if (file) void loadFile(file)
})

// Step 3: report, then download (ADR-0004: the download control exists only after the report renders)
const showResult = (result: ProcessResult): void => {
  lastResult = result
  replaceChildren(reportContainer, el('h3', {}, 'Change report'), renderReport(result.report))
  replaceChildren(downloadContainer)
  if (result.outputBytes === null || !result.report.canDownload) {
    downloadContainer.append(el('p', { class: 'status error' }, 'Errors block the download. Fix the input and transform again.'))
    return
  }
  const output = result.outputBytes
  const isBinary = result.report.input.format === 'binary'
  const downloadButton = el('button', { type: 'button' }, `Download ${result.outputFileName}`)
  downloadButton.addEventListener('click', () => {
    downloadBlob(output.slice(), result.outputFileName, isBinary ? 'application/octet-stream' : 'text/x-gcode')
    counter.recordProcessed()
  })
  downloadContainer.append(downloadButton, el('span', { class: 'muted' }, 'Check the report above before printing.'))
}

transformButton.addEventListener('click', async () => {
  if (!loadedFileName) return
  const problems = configForm.problems()
  if (problems.length > 0) {
    uploadStatus.className = 'status error'
    uploadStatus.textContent = `Fix the config first: ${problems.join('; ')}`
    return
  }
  transformButton.disabled = true
  uploadStatus.className = 'status'
  uploadStatus.textContent = 'Transforming in a worker…'
  try {
    const config: TowerConfig = configForm.getConfig()
    const result = await gcode.process(config)
    uploadStatus.textContent = result.report.canDownload
      ? `Report ready: ${result.report.inserted.length} tier commands inserted, ${result.report.neutralized.length} neutralized, ${result.report.warnings.length} warnings.`
      : `Report ready: ${result.report.errors.length} errors block the download.`
    showResult(result)
  } catch (error) {
    uploadStatus.className = 'status error'
    uploadStatus.textContent = `Transform failed: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    transformButton.disabled = false
  }
})

configForm.onChange(() => {
  // A config edit invalidates the previous report and its download.
  if (lastResult) {
    lastResult = null
    replaceChildren(reportContainer)
    replaceChildren(downloadContainer, el('p', { class: 'status' }, 'Config changed: transform again to get a fresh report.'))
  }
})

const app = document.getElementById('app')!
app.append(
  el(
    'main',
    {},
    el('h1', {}, 'Temperature Tower Generator'),
    el('p', { class: 'lead' }, 'For PrusaSlicer users: generate a labelled tower, slice it with your own profile, then let this page rewrite the G-code with one temperature per tier. Everything runs in your browser; files never leave your device.'),
    el('section', { class: 'step' }, el('h2', {}, '1. Tower config and STL'), configForm.element, el('div', { class: 'actions' }, generateButton), stlStatus),
    el('section', { class: 'step' }, el('h2', {}, '2. Upload the sliced G-code'), dropzone, uploadStatus, el('div', { class: 'actions' }, transformButton)),
    el('section', { class: 'step' }, el('h2', {}, '3. Review and download'), reportContainer, downloadContainer),
    el('footer', {}, `v${TOOL_VERSION}. Phase 1 supports PrusaSlicer G-code, plain or binary (.bgcode), with or without arc fitting, on Marlin, Prusa and Klipper firmware.`),
  ),
)
