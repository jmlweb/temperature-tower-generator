---
id: TSK-007
title: Public launch with counter and physical print gate
status: pending
priority: P3
tags: [release, community]
created: 2026-10-18
source: kickstart
depends-on: [TSK-001, TSK-002, TSK-003, TSK-004, TSK-005, TSK-006]
---

# Public launch with counter and physical print gate

## Description

**Outcome:** the tool is live on static hosting and PrusaSlicer users are told where to find it.
**Validates:** none
**Implements:** ADR-0001

## Acceptance Criteria

- [ ] One physical tower printed from PrusaSlicer output with labels matching tiers, photo in the release notes
- [x] Counter event fires once per download and never in dev or test builds
- [ ] Static site deployed and launch posts published on the Prusa forum and r/prusa3d by 2027-01-15

## Notes

## Learnings

## Progress Log

- [2026-10-18] Created
- [2026-10-18] Counter beacon implemented (`apps/web/src/counter.ts`, policy test proves no events in dev or test builds, fires once per download click in `main.ts`). Static build works (`pnpm build`). Physical print, deployment and launch posts still need the user.
