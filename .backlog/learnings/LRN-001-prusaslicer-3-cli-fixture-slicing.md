---
id: LRN-001
title: Slicing fixtures with the PrusaSlicer 3.0 CLI
tags: [fixtures, prusaslicer, tooling]
status: active
created: 2026-10-18
related: [TSK-006, RPT-001]
---

# Slicing fixtures with the PrusaSlicer 3.0 CLI

## Context

`scripts/slice-fixtures.ts` produces the real G-code fixtures. PrusaSlicer 3.0.0-alpha12 changed the CLI contract compared with 2.x, and several things only surfaced by trying.

## Learnings

- Per-option flags such as `--arc-fitting disabled` are accepted silently and ignored. The only way to change settings is `--printer-profile/--print-profile/--material-profile ... --save cfg.json`, patch the JSON, then `--load cfg.json --export-gcode model.stl --output out.gcode`.
- The saved JSON nests settings under `configuration.print_settings`, `printer_settings` and `filament_settings`; `retract_lift` and `arc_fitting` live in `print_settings` in 3.0 (they were printer and print settings in 2.x), so the script patches whichever section holds the key.
- Arc fitting (`arc_fitting = "emit_center"`) is on by default in the stock 3.0 profiles. See RPT-001.
- Absolute E (`use_relative_e_distances = false`) is refused with `(35, [use_relative_e_distances, before_layer_gcode])` because the Prusa before-layer G-code contains `G92 E0.0`. Strip that line, and swap `M83` for `M82` in the start G-code, to mimic a user who switched to absolute E.
- Object labels in 3.0 output use `M486 A<name>` (firmware style); copies arrive as separate names, which is what the multiple-objects check counts.
- Output names derive from `output_filename_format`, so sliced files keep the STL base name and the config decodes from the file name.
- Fixture towers use 3 tiers of 6 mm on a 1 mm base (19 mm) to keep each sliced file around 0.7–1.3 MB; a full 9-tier tower is about five times larger.
