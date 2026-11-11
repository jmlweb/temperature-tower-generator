---
id: TSK-014
title: Fix: Binary G-code report status double-counts inserted tier commands
status: complete
priority: P4
tags: []
created: 2026-11-08
source: report/RPT-007
depends-on: []
completed: 2026-11-11
started: 2026-11-11
---

# Fix: Binary G-code report status double-counts inserted tier commands

## Description

Source: RPT-007.

For `.bgcode` input the transform emits two `insert` changes per tier (marker comment line plus bare command, ADR-0007), and `apps/web/src/main.ts:175` uses `report.inserted.length` as the tier command count, so the status line shows double the number in the output header (`packages/core/src/transform.ts:90`). Count tier commands from the placed tiers (or exclude marker lines) so UI and header agree. Keep the ADR-0002 line rules unchanged.

## Acceptance Criteria

- [x] The step 2 status line reports the number of tier commands, matching the output header count, for both plain and binary input — evidence: main.ts status uses countTierCommands(report.tiers), the same function the header uses (2026-11-11)
- [x] A test covers the count for a binary (line marker style) transform, e.g. the coreone-binary fixture reports 3 tier commands — evidence: transform.test.ts line-style test and fixtures.test.ts coreone-binary assert 3; every fixture checks header == count (2026-11-11)
- [x] pnpm test and pnpm typecheck pass — evidence: pnpm typecheck ok; pnpm test 110 passed (2026-11-11)

## Notes

## Learnings

## Progress Log

- [2026-11-08] Created
- [2026-11-11] countTierCommands in core shared by header and UI status line
- [2026-11-11] Completed