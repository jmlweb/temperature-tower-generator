---
id: TSK-003
title: User downloads a labelled tower STL that matches the config
status: complete
priority: P2
tags: [geometry, web]
created: 2026-10-18
completed: 2026-10-18
source: kickstart
depends-on: [TSK-001]
---

# User downloads a labelled tower STL that matches the config

## Description

**Outcome:** a user picks a material preset (PLA or PETG) and a range, and downloads an STL whose labels match the tiers, with the config encoded in the filename.
**Validates:** none
**Implements:** ADR-0005, ADR-0006

## Acceptance Criteria

- [x] Generated mesh is manifold and its height is b + n·h
- [x] Each tier label shows that tier temperature
- [x] Filename config encode and decode round-trip is lossless
- [x] Geometry and transform share one tier-boundary function

## Notes

Evidence per acceptance criterion:
- `packages/geometry/src/tower.test.ts`: `isManifold` passes and `meshHeight` equals `towerHeight(config)` (b + n·h).
- Same test reads each label back from the mesh front face with `readLabel` and compares it to the tier temperature bitmap.
- `packages/core/src/filename-codec.test.ts`: fast-check round-trip over random configs.
- `tierBoundaryZ` in `packages/core/src/tower-config.ts` is the only `b + i·h`; geometry (`tower.ts`) and transform (`planTiers`) both import it.

## Learnings

## Progress Log

- [2026-10-18] Created
- [2026-10-18] Implemented in the `worktree-mvp` branch as part of the MVP build; all suites green (`pnpm test`, `pnpm typecheck`, `pnpm build`).
