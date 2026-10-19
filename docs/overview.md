# Slicer-Agnostic Temperature Tower Generator

PrusaSlicer users who want the best nozzle temperature for a new filament have no built-in temperature tower. They hand-insert custom G-code, or paste formulas into their printer profile, and that fails silently. This browser tool generates a labelled tower STL, rewrites the G-code they sliced with their own profile, and shows every change before download, all without install or server. "Slicer-agnostic" describes the core design (ADR-0003); Phase 1 supports PrusaSlicer only.

## Problem
PrusaSlicer has no temperature tower generator. OrcaSlicer and Bambu Studio ship one, and Cura has a plugin ([All3DP](https://all3dp.com/2/prusaslicer-temperature-tower/), [Prusa forum request](https://forum.prusa3d.com/forum/prusaslicer/prusa-slicer-should-include-filament-calibration-models-and-files)).

Workaround: a fixed-range STL from Printables, plus custom G-code added per layer with the slider, or a `M104 S{… layer_z …}` formula pasted into Printer Settings (Expert mode). It costs 10–20 minutes per filament (unverified: user to confirm) and leaves a profile edit behind. It also fails silently: users report temperatures that never change ([Prusa forum](https://forum.prusa3d.com/forum/prusaslicer/temp-change-in-slicer/)) and tiers starting at the wrong layer.

Why now: nothing changed; browser-side CSG only makes the no-install version cheaper to build.

## Users
Hobbyist FDM owners who slice in PrusaSlicer and just opened a new spool or brand of filament. They want to find its best nozzle temperature without editing profiles or computing layer heights.

## Success metric
100 G-code processing events (one anonymous event per download of transformed G-code) or 50 GitHub stars by 2027-04-15, after a public launch by 2027-01-15.

## Riskiest assumption
PrusaSlicer users will run a 3-step flow (download STL, slice, upload G-code) instead of the pasted-formula workaround or switching to OrcaSlicer's built-in tower. TSK-001 tests it: it posts a hand-made demo (generated STL plus a before/after G-code report) to the Prusa forum and r/prusa3d. The assumption holds with at least 5 counted replies, summed across both boards, within 14 days. A counted reply comes from a distinct account, is written after the demo was posted, states that its author uses PrusaSlicer, and says they would use or did use the flow. It is refuted with fewer than 5, or if most replies recommend switching to OrcaSlicer. If a board blocks the post, Printables comments on a popular temperature tower model replace it. Decision by 2026-11-15.
If refuted: stop per the kill criteria, or pivot by re-running `/flowstate:kickstart`
with the new assumption.

## Kill criteria
- Stop by 2026-11-15 if TSK-001 refutes the riskiest assumption: fewer than 5 counted replies across the Prusa forum and r/prusa3d within 14 days, or replies mostly recommending OrcaSlicer.
- Stop early if TSK-001 finds an existing tool that already gives PrusaSlicer users a tower with matching labels and a verified G-code change.
- Stop if, by 2027-04-15, fewer than 20 G-code processing events are counted and the PrusaSlicer community posts no "this solved my problem" reply from a distinct account.

These are checked first against TSK-001's result: a refuted assumption meets them unless the user pivots.

## Scope
- In (Phase 1): parametric tower STL generated in the browser, with labels, PLA, PLA+, PLA silk, PETG, ABS, ASA, TPU, HIPS, PA and PC presets, and the config encoded in the filename.
- In (Phase 1): PrusaSlicer ASCII G-code analysis, transformation, validation and preview. Arc moves (`G2`/`G3`) are an error.
- In (Phase 1): Marlin / Prusa / Klipper dialect (`M104`, or `M109` when the config's wait-for-temperature flag is set).
- In (Phase 1): static hosting with an anonymous event counter.
- Phase 2 (always): optional back text, the RepRapFirmware dialect (`G10 P0 S…`). Binary G-code (`.bgcode`, ADR-0007) and arc moves (ADR-0008) moved into Phase 1 because the Core One's stock profile produces both by default.
- Phase 2 (conditional): OrcaSlicer and Cura fixtures and config readers. These go ahead only if TSK-001 or post-launch reports show those users want the verified change report.
- Phase 3 (conditional, same evidence rule): more slicers and material presets.
- Out: full calibration suite (PA, flow, input shaping), slicing inside the tool, accounts, cloud storage, server-side processing.

Roadmap gates: Phase 1 ends with one physical tower printed from PrusaSlicer output. Phase 2 starts after the first external failing-G-code report is triaged.

## Constraints
- Time: ~5 h/week, spare time; public launch by 2027-01-15. Phase 1 plus TSK-001 is ~67 h before cuts and ~59 h after, against a ~61 h window (see `docs/evaluation.md`).
- Budget: €0 beyond a free static host and a free-tier event counter.
- Platform: desktop browsers only.
- Privacy: no telemetry beyond an anonymous event counter; files never leave the device.
- Stack: TypeScript strict, pnpm workspace, Vite.
- Compatibility: Phase 1 supports PrusaSlicer ASCII G-code on Marlin/Prusa/Klipper firmware.

## Architecture
- ADR-0001 Client-side only on static hosting, with a third-party event counter as the only runtime dependency: €0, no operations, files stay on the device.
- ADR-0002 Line-preserving pure transform off the UI thread: untouched lines provably identical, core testable outside the browser.
- ADR-0003 Motion-derived layer boundaries with markers as cross-check: slicer-agnostic design, and resists the wrong-tier bug users report.
- ADR-0004 Validation gate and change report before download: verifiability is the differentiator.
- ADR-0005 One tower config drives geometry and transform, recovered from the file name, the object label or manual entry: labels always match temperatures.
- ADR-0006 Parametric CSG mesh generated in the browser: any config yields a matching tower without stored models or a server.
