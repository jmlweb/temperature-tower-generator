---
id: TSK-006
title: Correct towers for all common PrusaSlicer profile variants
status: complete
priority: P3
tags: [core, fixtures]
created: 2026-10-18
completed: 2026-10-18
source: kickstart
depends-on: [TSK-001, TSK-002]
---

# Correct towers for all common PrusaSlicer profile variants

## Description

**Outcome:** users whose PrusaSlicer profile uses Z-hop, relative extrusion or 0.15 mm layers get correct tier boundaries.
**Validates:** none
**Implements:** ADR-0002, ADR-0003

## Acceptance Criteria

- [x] 8 PrusaSlicer fixtures covering Z-hop on and off, absolute and relative E, 0.2 and 0.15 mm have golden outputs and report snapshots
- [x] Slicer marker and motion mismatch emits a warning
- [x] G2 or G3 arc input produces an error

## Notes

Evidence per acceptance criterion:
- 8 sliced fixtures `zhop-{on,off}_{rel,abs}-e_{0.20,0.15}` from PrusaSlicer 3.0.0-alpha12 (MK3S, Generic PLA) with goldens and report snapshots; `scripts/slice-fixtures.ts` regenerates them.
- `marker-mismatch` fixture and `validation.test.ts` emit the `marker-mismatch` warning; motion still decides the boundaries.
- `arc-moves` fixture (arc fitting on) and `validation.test.ts` produce the `arc-moves` error.

## Learnings

## Progress Log

- [2026-10-18] Created
- [2026-10-18] Implemented in the `worktree-mvp` branch as part of the MVP build; all suites green (`pnpm test`, `pnpm typecheck`, `pnpm build`).
