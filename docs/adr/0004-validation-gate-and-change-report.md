# 0004. Validation gate and change report before any download

**Status:** accepted; the binary G-code error is superseded by ADR-0007, which decodes `.bgcode` and keeps an error only for files that cannot be decoded (`binary-gcode-unreadable`)

## Context
The differentiator against the formula workaround is verifiability: the user sees every change before printing. A wrong G-code costs a failed multi-hour print and lost filament. Some inputs make a correct tower impossible.

## Decision
Validation produces two severities. Errors block the download, and warnings allow it.
- **Errors:** no extrusion detected, variable layer height, multiple objects or sequential printing, binary G-code (`.bgcode`), arc moves (`G2`/`G3`, Phase 1 only), and model height off from the expected height by more than one layer.
- **Warnings:** model height off by one layer or less, tier temperatures outside the material preset's range, a slicer marker disagreeing with motion, and multi-tool G-code (only the active tool is changed).

Every download is preceded by a report: the detected slicer and base temperature source, the warnings, a temperature-vs-Z chart, and the inserted and neutralized commands. The output file carries a header block stating the tool version, tower config and change summary.

## Consequences
- Users can check the result before printing, and the output file is self-describing for bug reports.
- Every new check must be added to one of the two lists, with a fixture that triggers it.
- Ruled out: a one-click "transform and download" without the report.
