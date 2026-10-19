# 0011. Warn when a tier is above the Prusa nozzle limit

**Status:** accepted; adds a warning to the ADR-0004 list

## Context
The Custom material allows up to 320 °C and the presets can be edited past their range. Current Prusa printers (MK4S, CORE One) cap the nozzle at about 290 °C (iFixit lists 290 °C; a Polymaker table lists 300 °C, so the sources conflict). The MINI caps lower, and older models differ. A tier above the limit makes the firmware refuse the command or stop with a max-temperature error mid-print.

## Decision
- `tower-config.ts` holds one constant, `PRUSA_MAX_NOZZLE_TEMPERATURE = 290`, and `temperaturesAbovePrinterLimit(config)`.
- The config form shows a preview warning, and validation emits the `temperature-above-printer-limit` warning with the offending temperatures. The tower still generates and the download stays reachable.
- The limit is fixed and not read from the G-code or the form.

## Consequences
- The warning misses printers below 290 °C and fires needlessly on printers that go higher.
- A fixture, `temperature-above-printer-limit`, triggers it (ADR-0004).
- Ruled out: a form field for the printer maximum, and a table keyed by `printer_model`. Revisit both if reports show the fixed limit misleads.
