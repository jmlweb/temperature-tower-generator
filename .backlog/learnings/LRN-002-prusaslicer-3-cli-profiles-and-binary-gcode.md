---
id: LRN-002
title: PrusaSlicer 3.0 CLI profile names, no binary export, and libbgcode facts
tags: [fixtures, prusaslicer, bgcode, tooling]
status: active
created: 2026-10-18
related: [TSK-008, ADR-0007, LRN-001]
---

# PrusaSlicer 3.0 CLI profile names, no binary export, and libbgcode facts

## Context

TSK-008 needed a Core One `.bgcode` fixture and a codec that matches what PrusaSlicer writes. Both took detours.

## Learnings

- 3.0 profile names differ from the 2.x `PrusaResearch.ini` names. The CLI resolves `<printer_config name> <tool name>` (for example `Prusa CORE One 0.4 HF`, with the tool named `0.4 HF`, not `0.4HF`) and filament names like `Generic PLA@COREONE HF0.4@COREONE 0.4`. `--printer-profile <name> --query-print-tool-filament-profiles --output profiles.json` lists the valid print and filament names for a printer; `--query-printer-models` lists printers.
- The 3.0.0-alpha12 CLI writes plain text on `--export-gcode` even when the printer profile has `binary_gcode = 1`, whatever the `--output` extension, and it renders no thumbnails (headless). `ProcessActions.cpp` on `master` picks the `.bgcode` extension from `binary_gcode`, so a later build may fix this. Until then `scripts/bgcode-from-text.ts` binarizes the text export like libbgcode's `from_ascii_to_binary`, with a stand-in QOI thumbnail.
- PrusaSlicer's default binarizer config: file and printer metadata uncompressed, print and slicer metadata Deflate (zlib wrapper), G-code blocks MeatPack-with-comments plus Heatshrink 12/4, CRC32, 64 KiB G-code cache split on line boundaries. 3.0 adds a second slicer-metadata block with JSON encoding (`prusaslicer_json_config` in text exports).
- MeatPack is lossy: inline comments go, `G<digit>` lines lose their spaces (the decoder re-inserts one before `X Y Z E F I J R S G P W H C A` on lines starting with `G`), lowercase `e x g` become uppercase on those lines, blank lines collapse. Whole-line comments survive, including leading whitespace since libbgcode commit `6f4ad7c`.
- libbgcode's `tests/data` has real reference files: `mini_cube_ps2.8.1.bgcode` (PrusaSlicer 2.8.1 export) and `mini_cube_b.bgcode` (converter output), each with a `_ref.gcode` decoded by libbgcode. The codec decodes both to those texts (the reference conversion drops content-less comment lines such as `;` and `; `), and re-encoding `mini_cube_b` gives the slicer's MeatPack bytes exactly. PrusaSlicer 2.8.1 packed `G` lines with a single trailing newline; current libbgcode emits two, so byte equality holds for current builds only. `BGCODE_REFERENCE_DIR` points the gated test at a local copy; the files are AGPL and stay out of the repo.
- The Python package `heatshrink2` (reference heatshrink bindings) decodes the TypeScript encoder's streams and produces the same sizes; useful as an independent check in a scratch venv.
