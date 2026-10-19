# 0010. Tiers start above the boundary and wait with `M109 R`

**Status:** accepted; amends ADR-0003 (layer mapping), ADR-0009 (wait command, warning) and ADR-0004 (warning list)

## Context
An expert review of the generator found two defects.
- A layer's Z is its top. The transform inserted tier `i` before the first layer with `z >= b + i·h`. That layer spans the last layer-height below the boundary, so it belongs to tier `i-1`, and every tier switched one layer early (tier 1 at Z 12.0 in `coreone-gui` with `b = 2`, `h = 10`). With `M109` the nozzle also paused on the last layer of the tier below.
- `M109 S<t>` waits only while heating on Marlin-derived firmware (Marlin docs); `M109 R<t>` waits in both directions. The default towers descend, so every tier step is a cooling step, and the "wait" switch did not wait. A Prusa forum report says MK3S firmware 3.10 waits on cooling even with `S`, so the Prusa behaviour is unconfirmed; `R` is correct in both cases. Klipper ignores `R` and waits in both directions anyway. ADR-0009 ruled out `R` because of RepRapFirmware, which is Phase 2.

## Decision
- **Layer mapping:** `planTiers` takes the first layer with `layer.z > startZ + Z_EPSILON`. Tier 0 (start Z 0) still lands on layer 0. `tierBoundaryZ` and `tierStartZ` are unchanged.
- **Waiting command:** a waiting tier (tier 0 always, tiers 1+ when `waitForTemperature`) is inserted as `M109 R<t>`. Non-waiting tiers stay `M104 S<t>`. The parser already reads `R` as the target.
- **Warning:** `first-layer-above-tier-0` is removed, because `M109 R` cools the nozzle to tier 0's temperature before the purge. Its fixture is deleted.
- **PC preset:** 290 → 260 °C, range 250–290, because Prusa's current printers cap the nozzle at about 290 °C.

## Consequences
- Goldens and report snapshots are regenerated; tier commands move one layer up.
- The ADR-0002 property test accepts `M109 R<n>` as an inserted command.
- When RepRapFirmware support starts (Phase 2), its dialect needs its own wait command (`G10` then `M116`).
- Ruled out: `M109 S<t> R<t>` (Marlin lets `S` win and skips the cooling wait).
