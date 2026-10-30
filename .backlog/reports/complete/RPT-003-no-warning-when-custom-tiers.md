---
id: RPT-003
title: No warning when Custom tiers fall below the cold-extrusion limit
type: improvement
severity: low
status: triaged
created: 2026-10-30
triaged: 2026-10-30
task-id: TSK-010
---

## What happens

A Custom tower can have tiers below the firmware's minimum extrusion temperature. Neither the form nor the report warns about it.

- `packages/core/src/tower-config.ts:245`: `temperaturesOutsidePreset` returns `[]` for `CUSTOM`. The Custom preset's own `minTemperature: 150` (`tower-config.ts:197`) is never checked.
- `packages/core/src/tower-config.ts:259`: `validateTowerConfig` only requires temperatures to be positive.
- `apps/web/src/config-form.ts:36-37`: the temperature inputs accept 100 °C (`min` is `'100'`).
- ADR-0011 added a warning for the upper nozzle limit only (`temperature-above-printer-limit`). Nothing covers the lower limit.

## Reproduction

```
node --input-type=module -e "import { validateTowerConfig, temperaturesOutsidePreset, temperaturesAbovePrinterLimit, tierTemperatures } from './packages/core/src/tower-config.ts'; const c = { material: 'CUSTOM', startTemperature: 160, endTemperature: 100, step: 10, blockHeight: 10, baseHeight: 1.4, waitForTemperature: false }; console.log(JSON.stringify({ problems: validateTowerConfig(c), tiers: tierTemperatures(c), outside: temperaturesOutsidePreset(c), above: temperaturesAbovePrinterLimit(c) }))"
```

Observed:

```
{"problems":[],"tiers":[160,150,140,130,120,110,100],"outside":[],"above":[]}
```

The tower generates and the download is reachable with no warning. Klipper's default `min_extrude_temp` is 170 °C (`klippy/extras/heaters.py:34-35` at commit 0cee841e31d701595b3e509a0b502f6e320f52a8). Below it, Klipper stops the print with "Extrude below minimum temp". Marlin-derived firmware has a similar cold-extrusion guard (`EXTRUDE_MINTEMP`); its value per Prusa model is not verified here.

## Note

A new check needs an ADR that amends the ADR-0004 list, plus a fixture that triggers it (project rule).
