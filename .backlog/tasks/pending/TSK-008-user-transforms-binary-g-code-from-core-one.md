---
id: TSK-008
title: User transforms binary G-code (.bgcode) from Core One and MK4-class printers
status: pending
priority: P1
tags: [gcode, prusaslicer, onboarding]
created: 2026-10-18
source: user
depends-on: [TSK-002, TSK-004]
---

# User transforms binary G-code (.bgcode) from Core One and MK4-class printers

## Description

**Outcome:** a user with a Prusa Core One, MK4S, XL or MINI uploads the `.bgcode` their slicer exports by default and gets a transformed `.bgcode` back, with the same report and guarantees as plain G-code.
**Validates:** none
**Implements:** new ADR (supersedes the "binary G-code is an error" line of ADR-0004 and extends ADR-0002 to the decoded text)

Why now: the Core One is the best-selling Prusa printer and its stock PrusaSlicer profiles enable "Supports binary G-code". Today those users hit the `binary-gcode` error on their first upload and must find a printer setting to switch it off. That is friction at the exact moment the tool should win them.

Scope:
- Decode `.bgcode` in the G-code worker: parse the block structure (file header, file metadata, printer metadata, thumbnails, print metadata, G-code blocks), undo Heatshrink and Deflate compression, unpack MeatPack. Candidate: `libbgcode` compiled to WASM, lazy-loaded like `manifold-3d`.
- Run the existing motion analysis, validation and line-preserving transform on the decoded text.
- Re-encode the transformed text with the same block parameters, keep all non-G-code blocks (thumbnails, metadata) byte-for-byte, and recompute checksums.
- Output file name `<base>_temptower.bgcode`; the report states that the input was binary and which compression and encoding the blocks used.
- Config recovery (ADR-0005) reads object names from the decoded text and from `objects_info` in the printer metadata block.
- Remove the `binary-gcode` error from `validateGcode`; replace it with an error for an unparseable or unsupported `.bgcode` version.

Out of scope: writing binary G-code for a plain-text input, and the Prusa Connect upload flow.

## Acceptance Criteria

- [x] New ADR accepted before implementation: binary G-code is supported by decode, transform, re-encode; the ADR-0002 line guarantee applies to the decoded text (ADR-0007)
- [x] A `.bgcode` fixture sliced from the fixture tower with a stock Core One profile (binary export on, arc fitting off) round-trips: decode, transform, encode, decode again, and the decoded output equals the golden (`fixtures/prusaslicer/coreone-binary.*`; the CLI cannot export binary, so the slice is converted by `scripts/bgcode-from-text.ts`, see LRN-002)
- [x] Non-G-code blocks (thumbnails, metadata) in the output are byte-for-byte equal to the input blocks (fixture test and codec unit test)
- [x] The property test from ADR-0002 also runs over the decoded text of a binary input (`transform.test.ts`)
- [x] The report shows the binary format version, block compression and encoding, and the download delivers `<base>_temptower.bgcode`
- [x] A plain `.gcode` upload downloads nothing extra: the codec is pure TypeScript inside the G-code worker bundle (about 10 kB), no WASM at all
- [x] Unsupported or corrupt `.bgcode` produces a clear error in the report and no output file (`binary-gcode-unreadable` fixture)
- [x] A `.bgcode` exported from the PrusaSlicer GUI with a Core One profile decodes and transforms (`fixtures/prusaslicer/coreone-gui.bgcode`, PrusaSlicer 2.9.6, 34 blocks, 4 thumbnails; config recovered from the file name, 460 layers, 92 mm, 9 tiers placed). Arcs from the stock profile are ordinary moves since ADR-0008
- [ ] One physical print on a Core One from the transformed `.bgcode` reaches every tier at its temperature (user gate, can land after launch)

## Notes

- Replaces the old workaround (PrusaSlicer, Printer Settings, General, Firmware, untick "Supports binary G-code").
- No WASM and no new dependency: `packages/core/src/bgcode` holds the container reader and writer, Heatshrink encoder and decoder, zlib inflate, MeatPack encoder and decoder (ported from libbgcode) and a UTF-8 codec. Verified against libbgcode's reference files and the `heatshrink2` reference bindings (LRN-002).
- MeatPack drops inline comments, so binary output carries the tier marker as its own comment line before a bare `M104`/`M109` (ADR-0007); the report lists both lines.
- Verification: `pnpm typecheck`, `pnpm build`, 98 tests; the built G-code worker bundle run in Node with a `self` shim decodes `coreone-binary.bgcode`, recovers the config from the object label, transforms it to the golden and emits a 164 KB `.bgcode`; the unreadable fixture yields `binary-gcode-unreadable` with no output.

## Learnings

- LRN-002: 3.0 CLI profile names, the alpha CLI's missing binary export, and the libbgcode facts the codec relies on.

## Progress Log

- [2026-10-18] Created from user feedback after the MVP: binary export is the default on the Core One, so the `binary-gcode` error blocks the most common new user.
- [2026-10-18] ADR-0007 written; codec, pipeline, worker, UI, fixtures and docs done. Remaining criteria need the user: a GUI-exported `.bgcode` and a physical Core One print.
- [2026-10-18] First real GUI export failed with `Heatshrink back-reference of 50 bytes at output offset 48`: the reference decoder's history starts zero-filled and the slicer's encoder matches against it. Fixed in `heatshrink.ts`, file added as a fixture. Only `arc-moves` then stood between a Core One user and a download.
- [2026-10-18] ADR-0008 lifts the arc error (RPT-001 resolved); the GUI export now transforms to a golden and downloads as `.bgcode`. Left: the physical Core One print.
