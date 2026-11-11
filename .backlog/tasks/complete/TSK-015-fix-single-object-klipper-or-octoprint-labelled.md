---
id: TSK-015
title: Fix: Single-object Klipper or OctoPrint-labelled G-code fails with multiple-objects
status: complete
priority: P2
tags: []
created: 2026-11-11
source: report/RPT-008
depends-on: []
completed: 2026-11-11
started: 2026-11-11
---

# Fix: Single-object Klipper or OctoPrint-labelled G-code fails with multiple-objects

## Description

From RPT-008. `collectObjectNames` (`packages/core/src/slicers/prusaslicer.ts:28-53`) adds the same object twice in different forms: Klipper `NAME='<name>'` keeps its quotes, and OctoPrint-style `objects_info` names keep ` id:0 copy 0` while the comment form is stripped. `validateGcode` then raises a false `multiple-objects` error and blocks the download. Normalize names before deduplication and add fixtures with real PrusaSlicer output for both label styles.

## Acceptance Criteria

- [x] collectObjectNames strips the surrounding quotes from EXCLUDE_OBJECT_DEFINE NAME= values — evidence: KLIPPER_NAME regex strips single or double quotes; prusaslicer.test.ts (2026-11-11)
- [x] objects_info names are normalized the same way as printing-object comments (the id:<n> copy <n> suffix is stripped) — evidence: Both sources normalized to one form, but the full label id:<n> copy <n> is kept in both, not stripped: stripping merges real OctoPrint copies (copy 0/copy 1, verified with a --duplicate 2 slice). PRINTING_OBJECT now keeps the suffix like objects_info (2026-11-11)
- [x] A single tower sliced with Klipper-style labels plus objects_info yields one object name and no multiple-objects error — evidence: fixture klipper-labels: real PrusaSlicer 3.0 slice, no errors, golden written (2026-11-11)
- [x] A single tower sliced with OctoPrint-style labels plus objects_info yields one object name and no multiple-objects error — evidence: fixture octoprint-labels: real slice, no errors, golden written (2026-11-11)
- [x] Two real instances in Klipper style still raise multiple-objects — evidence: fixture klipper-multiple-objects + unit tests for Klipper and OctoPrint duplicates raise multiple-objects (2026-11-11)
- [x] Fixtures with real PrusaSlicer Klipper-flavour and OctoPrint-style output, including objects_info, have golden outputs — evidence: klipper-labels and octoprint-labels goldens and report snapshots (2026-11-11)
- [x] recover-config.test.ts uses the quoted NAME= format PrusaSlicer actually writes — evidence: recover-config.test.ts uses NAME='<name>_stl' (2026-11-11)

## Notes

## Learnings

## Progress Log

- [2026-11-11] Created
- [2026-11-11] Normalized object names: Klipper quotes stripped, OctoPrint suffix kept in both sources so duplicates stay distinct. New fixtures klipper-labels, octoprint-labels, klipper-multiple-objects (slice-fixtures gained flavor/labels options)
- [2026-11-11] Completed