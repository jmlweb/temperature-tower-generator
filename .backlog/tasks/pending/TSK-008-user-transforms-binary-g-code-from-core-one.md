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
- Config recovery (ADR-0005) reads object names from the decoded text and from the print metadata block.
- Remove the `binary-gcode` error from `validateGcode`; replace it with an error for an unparseable or unsupported `.bgcode` version.

Out of scope: writing binary G-code for a plain-text input, and the Prusa Connect upload flow.

## Acceptance Criteria

- [ ] New ADR accepted before implementation: binary G-code is supported by decode, transform, re-encode; the ADR-0002 line guarantee applies to the decoded text
- [ ] A `.bgcode` fixture sliced from the fixture tower with a stock Core One profile (binary export on, arc fitting off) round-trips: decode, transform, encode, decode again, and the decoded output equals the plain-G-code golden for the same config, apart from the `[temptower]` header
- [ ] Non-G-code blocks (thumbnails, metadata) in the output are byte-for-byte equal to the input blocks
- [ ] The property test from ADR-0002 also runs over the decoded text of a binary input
- [ ] The report shows the binary format version, block compression and encoding, and the download delivers `<base>_temptower.bgcode`
- [ ] The decoder loads lazily and only when a binary input is uploaded; a plain `.gcode` upload never downloads the WASM
- [ ] Unsupported or corrupt `.bgcode` produces a clear error in the report and no output file
- [ ] One physical print on a Core One from the transformed `.bgcode` reaches every tier at its temperature (user gate, can land after launch)

## Notes

- Replaces the current workaround: PrusaSlicer, Printer Settings, General, Firmware, untick "Supports binary G-code".
- Keep the `binary-gcode` validation code until the new ADR lands; the existing `binary-gcode` fixture then becomes the corrupt-file fixture.
- `scripts/slice-fixtures.ts` needs a Core One printer profile and `binary_gcode = 1` in the saved JSON to produce the fixture.

## Learnings

## Progress Log

- [2026-10-18] Created from user feedback after the MVP: binary export is the default on the Core One, so the `binary-gcode` error blocks the most common new user.
