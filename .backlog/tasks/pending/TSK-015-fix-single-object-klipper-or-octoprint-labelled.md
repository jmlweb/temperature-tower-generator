---
id: TSK-015
title: Fix: Single-object Klipper or OctoPrint-labelled G-code fails with multiple-objects
status: pending
priority: P2
tags: []
created: 2026-11-11
source: report/RPT-008
depends-on: []
---

# Fix: Single-object Klipper or OctoPrint-labelled G-code fails with multiple-objects

## Description

From RPT-008. `collectObjectNames` (`packages/core/src/slicers/prusaslicer.ts:28-53`) adds the same object twice in different forms: Klipper `NAME='<name>'` keeps its quotes, and OctoPrint-style `objects_info` names keep ` id:0 copy 0` while the comment form is stripped. `validateGcode` then raises a false `multiple-objects` error and blocks the download. Normalize names before deduplication and add fixtures with real PrusaSlicer output for both label styles.

## Acceptance Criteria

- [ ] collectObjectNames strips the surrounding quotes from EXCLUDE_OBJECT_DEFINE NAME= values
- [ ] objects_info names are normalized the same way as printing-object comments (the id:<n> copy <n> suffix is stripped)
- [ ] A single tower sliced with Klipper-style labels plus objects_info yields one object name and no multiple-objects error
- [ ] A single tower sliced with OctoPrint-style labels plus objects_info yields one object name and no multiple-objects error
- [ ] Two real instances in Klipper style still raise multiple-objects
- [ ] Fixtures with real PrusaSlicer Klipper-flavour and OctoPrint-style output, including objects_info, have golden outputs
- [ ] recover-config.test.ts uses the quoted NAME= format PrusaSlicer actually writes

## Notes

## Learnings

## Progress Log

- [2026-11-11] Created