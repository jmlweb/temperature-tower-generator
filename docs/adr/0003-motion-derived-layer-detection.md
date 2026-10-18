# 0003. Layer boundaries derived from motion, slicer markers as cross-check

**Status:** accepted

## Context
Phase 1 targets PrusaSlicer only. The core is designed to stay slicer-agnostic, so the conditional Phase 2 (OrcaSlicer, Cura) needs no rewrite. Slicer layer markers differ by slicer and can be absent or misleading (Z-hop, travel moves). Tiers starting at the wrong layer is the failure users already report with the formula workaround.

## Decision
A motion state machine (absolute/relative positioning, absolute/relative extrusion, position resets) defines a layer as the first extruding move above the current layer Z. A Z raise without extrusion is only a candidate, and a raise that returns before extruding is a Z-hop. Slicer comment markers and per-slicer config readers are optional adapters. They supply defaults and a cross-check, and a mismatch between them and motion produces a warning, not a different result.

## Consequences
- Adding a slicer means adding fixtures and, optionally, an adapter; the core logic stays unchanged.
- G-code with unknown or missing markers still gets correct boundaries.
- G-code with no extrusion yields zero layers, and ADR-0004 classifies that as an `error`.
- Detection must handle relative extrusion, `G92 E0` and Z-hop explicitly, each with fixtures. Arc moves (`G2`/`G3`) are an `error` in Phase 1, because PrusaSlicer's arc fitting is off by default; support moves to Phase 2.
- Detection costs more than trusting markers, and edge cases need property-based tests.
