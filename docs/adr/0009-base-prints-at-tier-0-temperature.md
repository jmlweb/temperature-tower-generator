# 0009. The base prints at the tier 0 temperature

**Status:** accepted; changes the neutralize rule of ADR-0002 and how the transform reads tier starts under ADR-0005

## Context
ADR-0002 keeps every line below the first tier boundary, and the tier 0 command goes in at Z = `b`. The base plate (0 to 1.4 mm on the presets) therefore prints at the profile's `first_layer_temperature` (215 °C in the MK3S fixtures, 210 °C in `coreone-gui`), and tier 0's temperature (230 °C) arrives `b` mm up. Users expect the print to start at the tier they configured. Instead, the chart and report show a base stub they never set, and tier 0's first layers print while the nozzle is still heating. Motion analysis (ADR-0003) puts the start G-code's intro or purge line into layer 0, because it extrudes at the first layer's Z. In `zhop-on_abs-e_0.20` and `coreone-gui`, layer 0's first line is the intro or purge move, not the first object move.

## Decision
Tier 0's temperature covers Z 0 up to the tier 1 boundary.
- **Placement:** the tier 0 command goes before the first extruding move of the file, which is layer 0's first line. In PrusaSlicer's stock start G-code, that is the intro or purge line, after the last start `M109`. The purge therefore runs at tier 0's temperature and cleans off the ooze from the heat-up, with the nozzle parked off the part. The position comes from motion alone, so tier 0 uses the same rule as every other tier.
- **Waiting:** tier 0 is always inserted as `M109 S<t0>`, whatever `waitForTemperature` says. The flag applies to tiers 1 and up only. The inserted line in the report shows `M109`. The header's tiers line ends in `(… tier 0 M109 wait, tiers 1+ M109 wait)` or `(… tier 0 M109 wait, tiers 1+ M104 no wait)`. When the first-layer temperature already equals `t0`, the `M109` returns at once.
- **Neutralization:** every `M104`/`M109` after the tier 0 insertion line is neutralized unless it is a turn-off (`S0` or lower); a line without `S` is neutralized, as today. This includes the profile's layer 2 "other layers" change. Turn-off commands are kept, as today. Lines before the first extruding move (the start G-code heat-up included) are kept byte-for-byte. Every edit is still one of ADR-0002's three kinds, so the line-preserving guarantee and its property test hold unchanged.
- **Tier start:** `tower-config.ts` gains `tierStartZ(config, i)`, which returns 0 for `i = 0` and `tierBoundaryZ(config, i)` otherwise. `planTiers` searches from `tierStartZ`, and Z 0 matches layer 0 with no special case. Geometry keeps `tierBoundaryZ` for labels and `towerHeight`, and `b + i·h` keeps its single implementation. The report's Z column shows the tier start: 0 for tier 0.
- **Adhesion:** a hotter first layer is accepted. Tier 0 is a temperature the user chose for this filament; a range outside the preset already raises `temperature-outside-preset`. Extra elephant's foot shows only on the base plate, which nobody measures. Bed temperature is not touched.

## Consequences
- The chart has no base stub: tier 0's band starts at Z 0. The report still shows the profile's first-layer temperature as the value that tier 0 replaces.
- Every passing fixture's golden and report gets regenerated with `pnpm fixture`: the tier 0 line moves to layer 0's first line as `M109`, `boundaryZ` becomes 0 for tier 0, and the header and chart change.
- New fixtures: one where `first_layer_temperature` is below tier 0 and there is no layer 2 change, and one where `temperature` differs from `first_layer_temperature`, so the layer 2 `M104` is neutralized.
- The AGENTS.md neutralize rule and its fixture requirement change from "at or above the first tier boundary" to "after the tier 0 insertion point".
- Any tower whose `t0` is below the profile's `first_layer_temperature` prints the purge and its first lines too hot, ascending or descending alike (PLA 205 to 180 °C on a 215 °C first layer), because `M109 S` waits only while heating on Marlin and Prusa firmware. A new ADR-0004 warning, `first-layer-above-tier-0`, reports it with both temperatures, and gets its own fixture.
- On printers whose start G-code parks the nozzle at the intro line's start (MK3S after `G80`), the nozzle heats there at Z 0.2 and oozes a small blob onto the bed. The intro line wipes it, off the part; this is accepted.
- Ruled out:
  - Rewriting the start G-code's `M109` value in place: ADR-0002 forbids in-place rewrites.
  - Inserting right after the last start `M109` by position: on the MK3S, `G28`/`G80` run after it, so homing and mesh levelling would run at the hotter temperature. That position is also not a motion fact.
  - Inserting after the intro line, before the first object move: the intro line and layer 1 share a motion layer. Splitting them needs `;LAYER_CHANGE` markers, which ADR-0003 forbids.
  - Honouring `waitForTemperature` for tier 0: a bare `M104` lets layer 0 print while the nozzle heats, which is the bug.
  - `M109 R`: RepRapFirmware reads `R` as standby temperature, and Klipper ignores it.
  - An opt-out flag: it grows the config and the filename format, and ADR-0005 needs a new version marker for that.
