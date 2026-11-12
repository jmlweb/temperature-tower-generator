# 0013. The end temperature is reached exactly

**Status:** accepted; amends ADR-0005 (tower config)

## Context
`tierCount` floors `|end - start| / step` (RPT-004). Two configs passed validation and printed something other than what the form and the STL name say:

- A step larger than the range, such as 230 to 228 step 5, gives one tier and no temperature change.
- A step that does not divide the range, such as 230 to 190 step 15, prints 230, 215 and 200 °C. The form calls the end field "Top tier" and the STL name encodes `230to190`, but no tier prints at 190 °C.

Two readings are possible: the end temperature is the top tier, or it is only a bound. As a bound, the form label, the STL name (ADR-0005), the output header and the report would all have to show a derived top temperature instead of the one the user typed.

## Decision
- The end temperature is the top tier and is reached exactly.
- `validateTowerConfig` rejects a config with fewer than 2 tiers, and a step that does not divide `|end - start|`. The message names the nearest end temperatures that the step does reach.
- The config form shows the same problems, because it already lists `validateTowerConfig` problems.
- The tier formulas (`tierCount`, `tierTemperature`, `tierBoundaryZ`) are unchanged.

## Consequences
- Every material preset uses step 5 over a range of 30 or 40 °C, so all presets stay valid.
- An STL name or G-code header from an earlier version with a non-dividing step no longer validates after recovery. The user sees the problem in the form and fixes the step or the end temperature.
- Ruled out: treating the end temperature as a bound, which would make the STL name and the "Top tier" label wrong.
