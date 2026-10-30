---
id: RPT-002
title: Tier 0 M109 R turns the hotend off on Klipper firmware
type: bug
severity: high
status: triaged
created: 2026-10-30
triaged: 2026-10-30
task-id: TSK-009
---

## What happens

Every transformed file starts tier 0 with `M109 R<t>` (`packages/core/src/transform.ts:72` makes tier 0 always a waiting tier; `packages/core/src/transform.ts:76` emits `M109 R`). With the "wait for temperature" switch on, every tier gets `M109 R<t>`.

Klipper does not read `R`. Its `cmd_M109` calls `cmd_M104`, which reads only `S` and defaults to 0:

- `klippy/kinematics/extruder.py:262` at Klipper commit 0cee841e31d701595b3e509a0b502f6e320f52a8: `temp = gcmd.get_float('S', 0.)`
- `klippy/extras/heaters.py:363-364` at the same commit: `heater.set_temp(temp)` then `if wait and temp:` (no wait for target 0)
- `klippy/extras/heaters.py:34-35`: `min_extrude_temp` defaults to 170 °C, and `can_extrude` turns false below it (line 96)

So on stock Klipper, `M109 R230` sets the hotend target to 0 °C (heater off) and returns at once. The first layer starts with the heater off. When the nozzle falls below 170 °C, Klipper stops with "Extrude below minimum temp".

## Observed output

Every golden fixture has this line before the first extruding move, for example:

```
fixtures/prusaslicer/zhop-on_abs-e_0.20.golden.gcode:44:M109 R230 ; [temptower] tier 0
```

## Documented but broken

- `apps/web/src/main.ts:70`: "Works with Marlin, Prusa and Klipper firmware"
- `README.md:35` and `docs/overview.md:33`: "Marlin/Prusa/Klipper dialect"
- `docs/adr/0010-tier-starts-above-boundary-and-waits-with-m109-r.md:8`: "Klipper ignores `R` and waits in both directions anyway". Klipper does ignore `R`, but it then uses the target `S`=0 and does not wait.

## Note

The fix contradicts ADR-0010, so a new ADR comes first (project rule). PrusaSlicer writes `gcode_flavor = klipper` in the config comments, which could select the dialect. Another option is to emit both `S` and `R`, if Marlin and Prusa firmware handle that combination correctly.
