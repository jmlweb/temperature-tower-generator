/**
 * Converts a plain PrusaSlicer G-code export into `.bgcode`, mirroring
 * libbgcode's `from_ascii_to_binary` (convert/convert.cpp) and the block
 * configuration PrusaSlicer uses when it exports binary G-code itself: file,
 * printer and JSON config blocks uncompressed, print and slicer config blocks
 * Deflate-compressed, G-code blocks MeatPack-with-comments encoded and
 * Heatshrink 12/4 compressed, CRC32 checksums.
 *
 * It exists because the PrusaSlicer 3.0 CLI writes text even when the printer
 * profile enables binary G-code (see LRN-002); the GUI export is the reference,
 * and a GUI-exported fixture remains a user gate of TSK-008.
 */
import { deflateSync } from 'node:zlib'
import {
  BgcodeBlockType,
  BgcodeCompression,
  ChecksumType,
  GcodeEncoding,
  MetadataEncoding,
  compressData,
  concatBytes,
  encodeGcodeBytes,
  encodingParameters,
  formatIni,
  splitGcodeChunks,
  utf8Encode,
  writeBlock,
  writeFileHeader,
} from '../packages/core/src/index.ts'

const PRINTER_KEYS = [
  'printer_model',
  'filament_type',
  'filament_abrasive',
  'nozzle_diameter',
  'nozzle_high_flow',
  'bed_temperature',
  'brim_width',
  'fill_density',
  'layer_height',
  'temperature',
  'ironing',
  'support_material',
  'max_layer_z',
  'extruder_colour',
  'filament used [mm]',
  'filament used [cm3]',
  'filament used [g]',
  'filament cost',
  'estimated printing time (normal mode)',
  'estimated printing time (silent mode)',
  'total filament used for wipe tower [g]',
  'total toolchanges',
  'objects_info',
] as const

const PRINT_KEYS = [
  'total toolchanges',
  'filament used [mm]',
  'filament used [cm3]',
  'filament used [g]',
  'filament cost',
  'total filament used [g]',
  'total filament cost',
  'total filament used for wipe tower [g]',
  'estimated printing time (normal mode)',
  'estimated printing time (silent mode)',
  'estimated first layer printing time (normal mode)',
  'estimated first layer printing time (silent mode)',
] as const

/** Keys the converter looks for, in its order; `shared` ones also stay in the config section. */
const COLLECTED: readonly { readonly key: string; readonly shared: boolean }[] = [
  { key: 'printer_model', shared: true },
  { key: 'filament_type', shared: true },
  { key: 'filament_abrasive', shared: true },
  { key: 'nozzle_diameter', shared: true },
  { key: 'nozzle_high_flow', shared: true },
  { key: 'bed_temperature', shared: true },
  { key: 'brim_width', shared: true },
  { key: 'fill_density', shared: true },
  { key: 'layer_height', shared: true },
  { key: 'temperature', shared: true },
  { key: 'ironing', shared: true },
  { key: 'support_material', shared: true },
  { key: 'max_layer_z', shared: false },
  { key: 'extruder_colour', shared: true },
  { key: 'filament used [mm]', shared: false },
  { key: 'filament used [g]', shared: false },
  { key: 'estimated printing time (normal mode)', shared: false },
  { key: 'filament used [cm3]', shared: false },
  { key: 'filament cost', shared: false },
  { key: 'total filament used [g]', shared: false },
  { key: 'total filament cost', shared: false },
  { key: 'total filament used for wipe tower [g]', shared: false },
  { key: 'estimated printing time (silent mode)', shared: false },
  { key: 'estimated first layer printing time (normal mode)', shared: false },
  { key: 'estimated first layer printing time (silent mode)', shared: false },
  { key: 'objects_info', shared: false },
  { key: 'total toolchanges', shared: false },
]

const THUMBNAIL_FORMATS = { thumbnail: 0, thumbnail_JPG: 1, thumbnail_QOI: 2 } as const

const trim = (value: string): string => value.replace(/^[ \t]+|[ \t]+$/g, '')
const uncomment = (value: string): string => (value.startsWith(';') ? trim(value.slice(1)) : value)
/** libbgcode matches keys by prefix: the first line starting with the key wins. */
const metadataValue = (line: string, key: string): string | null => {
  if (!line.startsWith(key)) return null
  const separator = line.indexOf('=')
  return separator === -1 ? null : trim(line.slice(separator + 1))
}

interface Thumbnail {
  readonly format: number
  readonly width: number
  readonly height: number
  base64: string
  readonly expectedSize: number
}

export interface ThumbnailImage {
  /** 0 PNG, 1 JPG, 2 QOI. */
  readonly format: number
  readonly width: number
  readonly height: number
  readonly data: Uint8Array
}

export interface ConversionOptions {
  /** Deflate implementation for the print and slicer metadata blocks; defaults to Node's zlib. */
  readonly deflate?: (data: Uint8Array) => Uint8Array
  /** Thumbnails to add when the text carries none: the headless CLI never renders them. */
  readonly fallbackThumbnails?: readonly ThumbnailImage[]
}

/** A one-colour QOI image (qoi header, one RGBA op, run ops, end marker): a valid preview for firmware screens. */
export const solidQoiThumbnail = (width: number, height: number, [r, g, b]: readonly [number, number, number]): ThumbnailImage => {
  const header = Uint8Array.of(0x71, 0x6f, 0x69, 0x66, width >>> 24, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff, height >>> 24, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff, 4, 0)
  const ops: number[] = [0xff, r, g, b, 0xff]
  let remaining = width * height - 1
  while (remaining > 0) {
    const run = Math.min(62, remaining)
    ops.push(0xc0 | (run - 1))
    remaining -= run
  }
  ops.push(0, 0, 0, 0, 0, 0, 0, 1)
  return { format: 2, width, height, data: concatBytes([header, Uint8Array.from(ops)]) }
}

/** Node's zlib produces the same wrapper libbgcode's `deflateInit` does. */
const nodeDeflate = (data: Uint8Array): Uint8Array => new Uint8Array(deflateSync(data))

export const bgcodeFromText = (text: string, { deflate = nodeDeflate, fallbackThumbnails = [] }: ConversionOptions = {}): Uint8Array => {
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()

  const fileMetadata: Record<string, string> = {}
  const collected = new Map<string, string>()
  const slicerConfig: Record<string, string> = {}
  const thumbnails: Thumbnail[] = []
  let slicerJson: string | null = null
  let readingConfig = false
  let readingJson = false
  let currentThumbnail: Thumbnail | null = null
  const gcodeLines: string[] = []

  lines.forEach((raw, index) => {
    const line = uncomment(trim(raw))
    if (line === '') return

    const generated = line.indexOf('generated by PrusaSlicer')
    if (generated !== -1) {
      const rest = trim(line.slice(generated + 'generated by PrusaSlicer'.length))
      const space = rest.indexOf(' ')
      const version = space === -1 ? rest : rest.slice(0, space)
      fileMetadata.Producer = `PrusaSlicer ${version}`
      if (space !== -1 && rest.slice(space, space + 4) === ' on ') fileMetadata['Produced on'] = rest.slice(space + 4)
      return
    }
    const prepared = line.indexOf('prepared by')
    if (index < 5 && prepared !== -1) {
      const value = trim(line.slice(prepared + 'prepared by'.length))
      if (value !== '') fileMetadata['Prepared by'] = value
      return
    }

    for (const { key, shared } of COLLECTED) {
      const value = metadataValue(line, key)
      if (value === null || value === '') continue
      if (!collected.has(key)) collected.set(key, value)
      if (!shared || !readingConfig) return
      break
    }

    if (!readingConfig) {
      if (metadataValue(line, 'prusaslicer_config') === 'begin') {
        readingConfig = true
        return
      }
    } else {
      if (metadataValue(line, 'prusaslicer_config') === 'end') {
        readingConfig = false
        return
      }
      const separator = line.indexOf('=')
      if (separator === -1) throw new Error(`Config line without '=': ${raw}`)
      const key = trim(line.slice(0, separator))
      if (key === '') throw new Error(`Config line without key: ${raw}`)
      slicerConfig[key] = trim(line.slice(separator + 1))
      return
    }

    if (currentThumbnail === null) {
      for (const [prefix, format] of Object.entries(THUMBNAIL_FORMATS)) {
        if (!line.startsWith(`${prefix} begin`)) continue
        const [size, expected] = trim(line.slice(`${prefix} begin`.length)).split(' ')
        const [width, height] = (size ?? '').split('x').map(Number)
        if (!width || !height || !expected) throw new Error(`Bad thumbnail header: ${raw}`)
        currentThumbnail = { format, width, height, base64: '', expectedSize: Number(expected) }
        thumbnails.push(currentThumbnail)
        return
      }
    } else {
      const ending = Object.keys(THUMBNAIL_FORMATS).find((prefix) => line.startsWith(`${prefix} end`))
      if (ending !== undefined) {
        if (currentThumbnail.base64.length !== currentThumbnail.expectedSize) throw new Error('Thumbnail size mismatch')
        currentThumbnail = null
        return
      }
      currentThumbnail.base64 += line
      return
    }

    if (!readingJson) {
      if (metadataValue(line, 'prusaslicer_json_config') === 'begin') {
        readingJson = true
        slicerJson = ''
        return
      }
    } else {
      if (metadataValue(line, 'prusaslicer_json_config') === 'end') {
        readingJson = false
        return
      }
      slicerJson += line
      return
    }

    gcodeLines.push(raw)
  })

  if (fileMetadata.Producer === undefined) throw new Error('No "generated by PrusaSlicer" line: not a PrusaSlicer export')
  if (readingConfig || currentThumbnail !== null || readingJson) throw new Error('Unterminated metadata section')

  const pick = (keys: readonly string[]): Record<string, string> =>
    Object.fromEntries(keys.flatMap((key) => (collected.has(key) ? [[key, collected.get(key)!]] : [])))
  const printerMetadata = pick(PRINTER_KEYS)
  const printMetadata = pick(PRINT_KEYS)
  const thumbnailImages: readonly ThumbnailImage[] =
    thumbnails.length > 0 ? thumbnails.map((thumbnail) => ({ ...thumbnail, data: new Uint8Array(Buffer.from(thumbnail.base64, 'base64')) })) : fallbackThumbnails

  const checksum = ChecksumType.CRC32
  const ini = encodingParameters(MetadataEncoding.INI)
  const compress = (data: Uint8Array, compression: number): Uint8Array => (compression === BgcodeCompression.DEFLATE ? deflate(data) : compressData(data, compression))
  const gcodeText = utf8Encode(`${gcodeLines.join('\n')}\n`)

  return concatBytes([
    writeFileHeader(checksum),
    writeBlock({ type: BgcodeBlockType.FILE_METADATA, compression: BgcodeCompression.NONE, parameters: ini, data: formatIni(fileMetadata) }, checksum),
    writeBlock({ type: BgcodeBlockType.PRINTER_METADATA, compression: BgcodeCompression.NONE, parameters: ini, data: formatIni(printerMetadata) }, checksum),
    ...thumbnailImages.map((thumbnail) =>
      writeBlock(
        {
          type: BgcodeBlockType.THUMBNAIL,
          compression: BgcodeCompression.NONE,
          parameters: Uint8Array.of(thumbnail.format, 0, thumbnail.width & 0xff, thumbnail.width >> 8, thumbnail.height & 0xff, thumbnail.height >> 8),
          data: thumbnail.data,
        },
        checksum,
      ),
    ),
    writeBlock({ type: BgcodeBlockType.PRINT_METADATA, compression: BgcodeCompression.DEFLATE, parameters: ini, data: formatIni(printMetadata) }, checksum, compress),
    writeBlock({ type: BgcodeBlockType.SLICER_METADATA, compression: BgcodeCompression.DEFLATE, parameters: ini, data: formatIni(slicerConfig) }, checksum, compress),
    ...(slicerJson === null
      ? []
      : [writeBlock({ type: BgcodeBlockType.SLICER_METADATA, compression: BgcodeCompression.NONE, parameters: encodingParameters(MetadataEncoding.JSON), data: utf8Encode(slicerJson) }, checksum)]),
    ...splitGcodeChunks(gcodeText).map((chunk) =>
      writeBlock(
        { type: BgcodeBlockType.GCODE, compression: BgcodeCompression.HEATSHRINK_12_4, parameters: encodingParameters(GcodeEncoding.MEATPACK_COMMENTS), data: encodeGcodeBytes(chunk, GcodeEncoding.MEATPACK_COMMENTS) },
        checksum,
      ),
    ),
  ])
}
