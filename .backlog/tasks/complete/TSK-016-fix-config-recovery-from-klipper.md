---
id: TSK-016
title: Fix: Config recovery from Klipper object labels fails for non-integer heights
status: complete
priority: P4
tags: []
created: 2026-11-11
source: report/RPT-009
depends-on: []
completed: 2026-11-11
started: 2026-11-11
---

# Fix: Config recovery from Klipper object labels fails for non-integer heights

## Description

From RPT-009. PrusaSlicer replaces `.` with `_` in Klipper object labels, so the default `b1.4` becomes `b1_4` and `decodeTowerConfigName` (`packages/core/src/filename-codec.ts:25-28`) returns null. Decode-only fix; no filename version bump or ADR needed.

## Acceptance Criteria

- [x] decodeTowerConfigName accepts _ as the decimal separator for block and base heights, so b1_4 decodes to 1.4 — evidence: filename-codec.ts NUMBER accepts [._]; test decodes b1_4 to 1.4 (2026-11-11)
- [x] The encoded v1 STL name is unchanged and the encode/decode round-trip test still passes — evidence: encoder untouched; round-trip property test passes (2026-11-11)
- [x] A recovery test with a sanitized Klipper label (temptower_v1_PLA_230to190_step5_h10_b1_4_m104_stl) returns the config with source object-label — evidence: recover-config.test.ts sanitized Klipper label returns source object-label (2026-11-11)

## Notes

## Learnings

## Progress Log

- [2026-11-11] Created
- [2026-11-11] Decode-only: _ accepted as decimal separator
- [2026-11-11] Completed