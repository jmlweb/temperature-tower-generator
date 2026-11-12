# 0014. Warn when a tier is below the cold-extrusion limit

**Status:** accepted; adds a warning to the ADR-0004 list

## Context
The Custom material allows tiers down to the form's minimum, and a preset can be edited below its range (RPT-003). Firmware refuses to extrude below a minimum temperature: Klipper stops the print with "Extrude below minimum temp", and Marlin-derived firmware skips the extrusion. Only the upper limit had a warning (ADR-0011).

The limits, as checked on 2026-11-12:

- Klipper `klippy/extras/heaters.py` at commit `0cee841e31d701595b3e509a0b502f6e320f52a8`: `min_extrude_temp` defaults to 170 °C.
- Marlin 2.1.2.5 `Marlin/Configuration.h`: `#define EXTRUDE_MINTEMP 170`.
- Prusa-Firmware v3.14.1 `Firmware/variants/MK3S.h`: `#define EXTRUDE_MINTEMP 175`.
- Prusa-Firmware-Buddy v6.2.0 `include/marlin/Configuration_MK4.h`: `#define EXTRUDE_MINTEMP 170`.

## Decision
- `tower-config.ts` holds one constant, `COLD_EXTRUSION_MIN_TEMPERATURE = 175`, the highest of the defaults above, and `temperaturesBelowColdExtrusionLimit(config)`, which returns the tier temperatures below it. It applies to every material, presets included.
- The config form shows a preview warning, and validation emits the `temperature-below-cold-extrusion-limit` warning with the offending temperatures. The tower still generates and the download stays reachable.
- The limit is fixed and not read from the G-code or the form.

## Consequences
- The warning fires for 170–174 °C tiers that Klipper, Marlin and the MK4 accept, and misses printers configured with a higher limit.
- No preset range goes below 180 °C, so the warning fires only for edited presets and Custom towers.
- A fixture, `temperature-below-cold-extrusion-limit`, triggers it (ADR-0004).
- Ruled out: a form field for the printer minimum, and reading the limit per firmware flavor. Revisit both if reports show the fixed limit misleads.
