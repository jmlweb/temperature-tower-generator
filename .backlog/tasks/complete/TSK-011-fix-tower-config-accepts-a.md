---
id: TSK-011
title: Fix: Tower config accepts a step that skips the top tier or leaves a single tier
status: complete
priority: P4
tags: []
created: 2026-11-02
source: report/RPT-004
depends-on: []
completed: 2026-11-12
started: 2026-11-12
---

# Fix: Tower config accepts a step that skips the top tier or leaves a single tier

## Description

`validateTowerConfig` accepts a step larger than the range (one tier, no temperature change) and a step that does not divide the range (the "Top tier" temperature is never printed). `tierCount` floors the division in `packages/core/src/tower-config.ts:219-220`. Reproduction and observed output are in RPT-004.

## Acceptance Criteria

- [x] A new ADR states whether the end temperature must be reached exactly or is a bound, before any code change — evidence: docs/adr/0013-tower-end-temperature-is-reached-exactly.md: end is reached exactly (2026-11-12)
- [x] validateTowerConfig rejects any config with fewer than 2 tiers — evidence: stepProblems rejects step > range (1 tier) (2026-11-12)
- [x] A step that does not divide the range is rejected, or the UI labels and STL name show the real top tier, as the ADR decides — evidence: non-dividing step rejected with the nearest reachable end temperatures (2026-11-12)
- [x] The config form shows the same problem as validation — evidence: config-form lists validateTowerConfig problems, so it shows the same message (2026-11-12)
- [x] A unit test covers 230 to 228 step 5 and 230 to 190 step 15 — evidence: tower-config.test.ts covers 230 to 228 step 5 and 230 to 190 step 15; all presets stay valid (2026-11-12)

## Notes

## Learnings

## Progress Log

- [2026-11-02] Created
- [2026-11-12] ADR-0013 and stepProblems in validateTowerConfig
- [2026-11-12] Completed