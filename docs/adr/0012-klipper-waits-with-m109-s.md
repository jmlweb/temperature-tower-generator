# 0012. Klipper waiting tiers use `M109 S`

**Status:** accepted; supersedes the Klipper line of ADR-0010 (waiting command) and amends ADR-0009

## Context
ADR-0010 made every waiting tier (tier 0 always, tiers 1+ when `waitForTemperature`) an `M109 R<t>`, and stated that "Klipper ignores `R` and waits in both directions anyway". The first half is right and the second is wrong (RPT-002). At Klipper commit `0cee841e31d701595b3e509a0b502f6e320f52a8`:

- `klippy/kinematics/extruder.py`: `cmd_M109` calls `cmd_M104`, which reads `temp = gcmd.get_float('S', 0.)`. `R` is never read, so `M109 R230` sets the target to 0 °C.
- `klippy/extras/heaters.py`, `set_temperature`: `heater.set_temp(temp)` then `if wait and temp:`. A target of 0 turns the heater off and does not wait.
- `klippy/extras/heaters.py`: `min_extrude_temp` defaults to 170 °C. Once the nozzle cools below it, Klipper stops with "Extrude below minimum temp".

So every transformed file turned the heater off before the first layer on stock Klipper.

The same source shows how `M109 S<t>` waits. `_wait_for_temperature` loops while `heater.check_busy()` is true. For `control: pid` (the hotend default), `check_busy` is `abs(target - temp) > 1` or a temperature slope above 0.1 °C/s, so it waits while cooling as well as while heating. For `control: watermark` (bang-bang), `check_busy` is `temp < target - max_delta`, so it waits only while heating.

Marlin and Prusa firmware still need `R` to wait while cooling (ADR-0010), and ADR-0010 ruled out `M109 S<t> R<t>` because Marlin lets `S` win. No single command works on both, so the command has to follow the firmware.

PrusaSlicer writes the printer's flavor as `; gcode_flavor = klipper` in the config block of plain G-code and in the metadata of binary G-code. The PrusaSlicer reader already merges both into one config map.

## Decision
- The transform takes a temperature dialect, `marlin` or `klipper`. `processGcode` picks `klipper` when the slicer config has `gcode_flavor = klipper`, and `marlin` for every other value or when the key is missing.
- `marlin` keeps ADR-0010 unchanged: waiting tiers are `M109 R<t>`, the others `M104 S<t>`.
- `klipper` makes waiting tiers `M109 S<t>`. Non-waiting tiers stay `M104 S<t>`, which Klipper reads correctly.
- Both marker styles (inline and own-line, ADR-0007) use the same command.
- The ADR-0002 property test accepts `M109 S<n>` as an inserted command and runs over both dialects.

## Consequences
- Every non-Klipper golden output stays byte-identical. The `klipper-labels` fixture (real PrusaSlicer slice with `gcode_flavor = klipper`) shows `M109 S` at tier 0.
- A Klipper printer whose PrusaSlicer profile keeps a Marlin flavor still gets `M109 R`, and its heater turns off. The UI, README and overview tell Klipper users to set the flavor to Klipper. Detecting Klipper from other hints (macros, `EXCLUDE_OBJECT_*`) is ruled out for now: those hints also appear in files for other firmware.
- On Klipper with a bang-bang hotend, waiting tiers wait only while heating, so a cooling tier starts before the nozzle reaches its temperature. This is Klipper's own `M109` behaviour and is accepted.
- Ruled out: Klipper's `TEMPERATURE_WAIT`, because it is not a temperature command the parser or the ADR-0002 rules know, and `M109 S` already waits both ways on PID hotends.
