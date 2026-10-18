---
id: RPT-001
title: PrusaSlicer 3.0 enables arc fitting by default, so every default slice hits the Phase 1 arc error
type: finding
status: resolved
priority: P2
tags: [core, validation, prusaslicer]
created: 2026-10-18
related: [TSK-006, TSK-008, ADR-0003, ADR-0008]
---

# PrusaSlicer 3.0 enables arc fitting by default

## Observation

Slicing the fixture tower with PrusaSlicer 3.0.0-alpha12 and the stock `Prusa MK3S 0.4` / `0.20mm QUALITY @MK3 0.4` / `Generic PLA` profiles emits `G2`/`G3` moves out of the box: the saved config has `print_settings.arc_fitting = "emit_center"`. ADR-0003 made arcs a Phase 1 `error` on the assumption that PrusaSlicer's arc fitting is off by default, which holds for 2.x but not for the 3.0 alpha.

The fixtures under `fixtures/prusaslicer/` were sliced with `arc_fitting = "disabled"` to match the ADR; `arc-moves.gcode` keeps the default to trigger the error.

## Impact

If 3.0 ships with this default, PrusaSlicer 3.0 users get the `arc-moves` error on their first upload and must change Print Settings > Advanced > Arc fitting and re-slice. The error message already tells them that.

## Suggested next step

Supporting arcs in the motion state is small: `G2`/`G3` already update XYZE in `packages/core/src/motion.ts`; only the validation gate turns them into an error. Decide before launch whether to add an ADR that moves arc support into Phase 1, or to keep the error and document the slicer setting in the launch post.

## Resolution

- [2026-10-18] A real Core One export from PrusaSlicer 2.9.6 confirmed the default (`arc_fitting = emit_center`) is not limited to the 3.0 alpha. ADR-0008 makes arcs ordinary moves; the `arc-moves` error is gone and the fixture became a passing one.
