---
name: add-fixture
description: Adds a sliced G-code fixture with its golden output and report snapshot. Use when the user says "add fixture", "new slicer variant", or attaches a failing G-code from an issue. Not for unit tests of a single function.
---

# Add fixture

## Inputs
- Slicer and version (Phase 1: PrusaSlicer only, per `AGENTS.md`)
- Variant: Z-hop on/off, absolute/relative E, layer height
- Tower config, or an STL filename that encodes it (ADR-0005)
- For a community report: the issue link and the user's G-code file

## Steps
1. Get the G-code.
   - **Own slice:** slice the tower STL in the target slicer with the named variant, without variable layer height or Z scaling.
   - **Community report:** use the user's file as given; do not re-slice. Strip personal paths and names from its comments. Record the issue link, and the slicer version taken from the file's header comments.
2. Save the G-code as `fixtures/<slicer>/<variant>.gcode`, with the tower config next to it as `fixtures/<slicer>/<variant>.config.json`. For a community report, name the variant after the issue number and put the issue link in the config file.
3. Run the fixture command from `AGENTS.md` Commands to write the outputs.
   - **Valid fixture:** it writes the golden output and the report snapshot.
   - **Error fixture** (a check in ADR-0004's `error` list): snapshot only the report, and assert that no output file is produced.
4. Review the golden diff by hand (ADR-0002, ADR-0004):
   - Each inserted tier command ends with ` ; [temptower] tier <i>`, and there is one per tier boundary, at the right Z: the first layer whose top is above the tier start (ADR-0010).
   - Inserted header lines start with `; [temptower]`.
   - Neutralized lines are only `M104`/`M109` lines at or above the first tier boundary, prefixed with `; [temptower] neutralized: `. Start G-code temperatures are kept.
   - The report's warnings and errors are the expected ones.
5. Run the full test suite, including the property tests, and confirm it passes.
6. If the fixture exposes a bug, keep it failing in a separate commit before the fix.

Done when the fixture, its config, golden output and report snapshot are on disk, and the suite passes or the failing case is recorded.
