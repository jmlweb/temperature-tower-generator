---
id: TSK-011
title: Fix: Tower config accepts a step that skips the top tier or leaves a single tier
status: pending
priority: P4
tags: []
created: 2026-11-02
source: report/RPT-004
depends-on: []
---

# Fix: Tower config accepts a step that skips the top tier or leaves a single tier

## Description

`validateTowerConfig` accepts a step larger than the range (one tier, no temperature change) and a step that does not divide the range (the "Top tier" temperature is never printed). `tierCount` floors the division in `packages/core/src/tower-config.ts:219-220`. Reproduction and observed output are in RPT-004.

## Acceptance Criteria

- [ ] A new ADR states whether the end temperature must be reached exactly or is a bound, before any code change
- [ ] validateTowerConfig rejects any config with fewer than 2 tiers
- [ ] A step that does not divide the range is rejected, or the UI labels and STL name show the real top tier, as the ADR decides
- [ ] The config form shows the same problem as validation
- [ ] A unit test covers 230 to 228 step 5 and 230 to 190 step 15

## Notes

## Learnings

## Progress Log

- [2026-11-02] Created