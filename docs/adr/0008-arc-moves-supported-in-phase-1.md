# 0008. Arc moves are supported in Phase 1

**Status:** accepted

## Context
ADR-0003 made `G2`/`G3` arcs a Phase 1 `error` on the assumption that PrusaSlicer's arc fitting is off by default. That held for 2.x profiles of the MK3 era. The stock Core One profile in PrusaSlicer 2.9.6 and every 3.0 profile set `arc_fitting = emit_center` (RPT-001), so the first real Core One export (a `.bgcode` from the GUI, fixture `coreone-gui.bgcode`) hit the arc error after ADR-0007 removed the binary one. Asking the best-selling printer's users to change a print setting and re-slice is the friction this tool exists to remove.

## Decision
Arc moves are ordinary moves for layer detection. The motion state already applies an arc's end point (`X`, `Y`, `Z`, `E`) like a linear move; an extruding arc at a new Z starts a layer exactly as `G1` does, and the arc's path between start and end point does not matter for tiers because the transform only inserts a command before the first extruding move of the layer. The `arc-moves` check is removed from the ADR-0004 error list; the motion analysis keeps counting arcs for the report and tests. Nothing in the transform inspects or rewrites `G2`/`G3` lines, so the ADR-0002 guarantee is untouched.

## Consequences
- Default PrusaSlicer 2.9.6 and 3.0 profiles work without a settings change, in plain and binary G-code.
- The `arc-moves` fixture becomes a passing fixture with a golden; the Core One GUI export becomes the second one.
- A helical arc that changes Z mid-move is treated by its end point, the same simplification PrusaSlicer's own preview uses for layer assignment.
- Ruled out: tessellating arcs into segments (no consumer of the intermediate points exists) and keeping a warning for arcs (nothing for the user to act on).
