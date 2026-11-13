---
id: LRN-004
title: Klipper fixtures and Klipper M109 semantics
status: active
tags: [fixtures, prusaslicer, klipper, tooling]
task: TSK-009
created: 2026-11-13
---

## Context

TSK-009 and TSK-015 needed real PrusaSlicer slices with `gcode_flavor = klipper` and with OctoPrint-style labels.

## Learnings

- The PrusaSlicer 3.0 CLI refuses `gcode_flavor = klipper` with `(9, [machine_limits_usage, gcode_flavor])` unless `machine_limits_usage` is `time_estimate_only`; `scripts/slice-fixtures.ts` patches it for Klipper variants.
- With Klipper flavor and firmware labels, PrusaSlicer writes `EXCLUDE_OBJECT_DEFINE NAME='<sanitized name>'` (quoted, `.` and spaces become `_`, duplicates get `_(Instance_N)`), plus an unquoted `; objects_info` JSON.
- OctoPrint-style labels are `; printing object <name> id:<n> copy <n>`; with `--duplicate 2` the copies differ only in `copy 0` / `copy 1`, so stripping that suffix merges real duplicates.
- Klipper reads only `S` in `M109`/`M104` (`R` alone means target 0, heater off). `M109 S` waits in both directions for `control: pid` heaters and only while heating for `control: watermark` (ADR-0012).

## Applies to

`scripts/slice-fixtures.ts`, `packages/core/src/slicers/prusaslicer.ts`, `packages/core/src/transform.ts`.
