---
id: TSK-014
title: Fix: Binary G-code report status double-counts inserted tier commands
status: pending
priority: P4
tags: []
created: 2026-11-08
source: report/RPT-007
depends-on: []
---

# Fix: Binary G-code report status double-counts inserted tier commands

## Description

Source: RPT-007.

For `.bgcode` input the transform emits two `insert` changes per tier (marker comment line plus bare command, ADR-0007), and `apps/web/src/main.ts:175` uses `report.inserted.length` as the tier command count, so the status line shows double the number in the output header (`packages/core/src/transform.ts:90`). Count tier commands from the placed tiers (or exclude marker lines) so UI and header agree. Keep the ADR-0002 line rules unchanged.

## Acceptance Criteria

- [ ] The step 2 status line reports the number of tier commands, matching the output header count, for both plain and binary input
- [ ] A test covers the count for a binary (line marker style) transform, e.g. the coreone-binary fixture reports 3 tier commands
- [ ] pnpm test and pnpm typecheck pass

## Notes

## Learnings

## Progress Log

- [2026-11-08] Created