---
id: TSK-019
title: Fix: First layer taller than the start G-code purge Z is rejected as variable layer height
status: pending
priority: P3
tags: []
created: 2026-11-26
source: report/RPT-012
depends-on: []
---

# Fix: First layer taller than the start G-code purge Z is rejected as variable layer height

## Description

Source: RPT-012. Stock PrusaSlicer start G-code purges at a hardcoded Z 0.2 (MK3S template `G1 Z0.2 F720`). Motion analysis makes the purge layer 0, so a first object layer above 0.2 mm becomes layer 1 with height `first_layer_height - 0.2`, which the uniform-height check in `packages/core/src/validation.ts:57` rejects, and the extra layer makes the marker count disagree (`validation.ts:97-104`). A first layer at or below the purge Z is unaffected.

Likely direction: treat the first layer as exempt from the uniform-height check even when a lower-Z start-G-code extrusion precedes it (for example, exempt every layer up to and including the first one at or above `first_layer_height`), and compare markers only against object layers. Keep motion as the source of layer boundaries (ADR-0003).

## Acceptance Criteria

- [ ] A fixture sliced with first_layer_height above the stock purge Z (e.g. 0.3 mm on 0.2 mm layers) passes validation with no variable-layer-height error and no marker-mismatch warning, and has a golden output
- [ ] A genuinely variable-layer-height slice still fails with variable-layer-height
- [ ] Tier 0 is still inserted before the first extruding move of the file (the purge), per ADR-0009
- [ ] If the change alters the layer definition of ADR-0003 or the purge assumption of ADR-0009, a new ADR is added first
- [ ] pnpm typecheck and pnpm test pass

## Notes

## Learnings

## Progress Log

- [2026-11-26] Created