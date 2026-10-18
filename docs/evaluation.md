# Evaluation: Slicer-Agnostic Temperature Tower Generator

**Feasibility:** feasible with caveats — everything runs client-side at €0, but Phase 1 plus TSK-001 is ~59 h after cuts, so the launch moves to 2027-01-15 with ~2 h of slack.
**Build:** build with changes — the gap is real only for PrusaSlicer users (Orca, Bambu Studio and Cura already cover theirs), so Phase 1 targets PrusaSlicer alone and later slicers need evidence.
**Goal:** community — 100 G-code processing events or 50 GitHub stars by 2027-04-15, after a public launch by 2027-01-15.

## Need
Pain: PrusaSlicer has no built-in temperature tower; users change temperature per height by hand.
- Guides describe the PrusaSlicer route as manual custom G-code per height range, while OrcaSlicer has a calibration menu ([All3DP](https://all3dp.com/2/prusaslicer-temperature-tower/)).
- Prusa forum users ask for built-in calibration prints ([request](https://forum.prusa3d.com/forum/prusaslicer/prusa-slicer-should-include-filament-calibration-models-and-files), [built-in calibration tools](https://forum.prusa3d.com/forum/prusaslicer/built-in-calibration-tools/)).
- Users report temperatures that silently do not change and need a dedicated custom G-code per layer ([temp change in slicer](https://forum.prusa3d.com/forum/prusaslicer/temp-change-in-slicer/)); a Printables tower's changelog fixes float errors that started tiers at the wrong layer ([Printables 38895](https://www.printables.com/model/38895-temperature-tower-auto-g-code-insertion-to-set-tem)).

Workaround: download a fixed-range tower STL, then either add custom G-code at each tier with the layer slider, or paste a generated formula into Printer Settings > Custom G-code (Expert mode) and check the Temperature legend in the preview. Cost: 10–20 minutes per filament (unverified: user to confirm), a printer profile edited and then forgotten, and labels that drift from the tested temperatures when the range or block height changes.

Why now: nothing changed. The need is years old; browser-side CSG (WASM) only makes the no-install version cheaper to build.

## Feasibility
- **Client-side only:** G-code parsing and transformation are pure text processing; a Web Worker keeps large files off the main thread. Holds.
- **STL generation in the browser:** WASM CSG and font-outline libraries exist and run in desktop browsers. Holds.
- **Static hosting, €0:** no first-party server code, so a free static host covers it. The usage metric relies on a free-tier, cookieless third-party event counter, and losing it costs only the metric. Holds.
- **Correctness:** layer detection from motion plus marker cross-checks needs real PrusaSlicer fixtures and one physical print before release. Holds, at a cost in time.
- **Time (~5 h/week):** from 2026-10-18, the window to 2026-12-31 is ~10.6 weeks (~53 h); to 2027-01-15 it is ~12.7 weeks (~61 h). Rough estimate before cuts:

  | Work | Hours |
  |------|-------|
  | TSK-001: hand-made demo STL, before/after report, posts, reply tally | 4 |
  | Parser, motion state, layer detection (incl. arcs) | 14 |
  | Transform, validation, PrusaSlicer config reader | 8 |
  | Parametric geometry with labels and back text, STL export, filename config | 12 |
  | UI: config, upload, report, temperature-vs-Z chart, download, worker wiring | 12 |
  | Material presets beyond PLA and PETG | 1 |
  | 8 fixtures, golden and property tests | 7 |
  | Counter, deploy, full E2E suite | 5 |
  | Physical print and fixes | 3 |
  | **Total before cuts** | **67** |

  Cuts, each moved to Phase 2:

  | Cut | Hours saved |
  |-----|-------------|
  | Arc support (arcs become an `error` in Phase 1) | 2 |
  | Back text | 2 |
  | Presets beyond PLA and PETG | 1 |
  | Full E2E suite, reduced to one smoke test | 3 |
  | **Total after cuts** | **59** |

  59 h does not fit the ~53 h window to 2026-12-31. It fits the ~61 h window to 2027-01-15, with ~2 h of slack. The launch moves to 2027-01-15. The metric and late kill check move to 2027-04-15, which keeps the same 3-month observation window. The TSK-001 decision date (2026-11-15) stays fixed. The preview chart is not cut, because it is the differentiator. If the estimate slips again, the next cut is the wait-for-temperature mode, before any date moves.

## Market
| Alternative | What it covers | Source |
|-------------|----------------|--------|
| OrcaSlicer Calibration > Temperature | Built-in tower, custom start/end, fixed 5 °C step | [OrcaSlicer wiki](https://www.orcaslicer.com/wiki/calibration/Calibration) |
| Bambu Studio Calibration > Temperature | Built-in tower | [Bambu wiki](https://wiki.bambulab.com/en/bambu-studio/Calibration) |
| Cura AutoTowersGenerator plugin | Preset towers (temperature, speed, flow); custom towers need OpenSCAD | [GitHub](https://github.com/kartchnb/AutoTowersPlugin) |
| PrusaSlicer + Printables formula towers | Fixed STL plus `M104 S{… layer_z …}` pasted into printer settings | [Printables 38895](https://www.printables.com/model/38895-temperature-tower-auto-g-code-insertion-to-set-tem) |
| OpenSCAD customizer tower | Parametric STL; prints G-code to paste into any slicer | [Printables 159286](https://printables.com/model/159286-parametric-simple-temp-tower-with-g-code-generator) |
| SmartTemperatureTower | CLI: slices with PrusaSlicer, inserts `M104` at layer changes; local install | [GitHub](https://github.com/thbitzer/SmartTemperatureTower) |
| gen_temp_tower | CLI: needs OpenSCAD and Slic3r | [GitHub](https://github.com/pcboy/gen_temp_tower) |

No browser-based, no-install tool that rewrites the user's own G-code turned up in the search.

## Gap
For OrcaSlicer, Bambu Studio and Cura users: no gap — their slicer or a marketplace plugin already covers this. Phase 2 support for them goes ahead only if TSK-001 or post-launch reports show they want the verified change report.
For PrusaSlicer users: a no-install tool that generates the tower with labels matching the tested temperatures, applies the temperatures to their own sliced G-code without editing the printer profile, and shows every change (temperature-vs-Z chart, inserted and neutralized commands) before download. The verifiable report is the differentiator; the formula workaround gives no such check.

## Viability
Community: PrusaSlicer users gather on the Prusa forum (PrusaSlicer section), r/prusa3d and Printables. They find the project through a launch post there, and through a Printables model page that links the tool. The forum feature requests above are the threads to answer.

## Riskiest assumption
PrusaSlicer users will run a 3-step flow (download STL, slice, upload G-code) instead of the pasted-formula workaround or switching to OrcaSlicer's built-in tower — validation: post a hand-made demo (generated STL plus a before/after G-code report) to the Prusa forum and r/prusa3d. It holds with at least 5 counted replies, summed across both boards, within 14 days of posting. It is refuted with fewer than 5, or if most replies recommend switching to OrcaSlicer instead. Decision by 2026-11-15 — result: pending: TSK-001
A counted reply comes from a distinct account, is written after the demo was posted, states that its author uses PrusaSlicer, and says they would use or did use the flow. If a board's rules block the post, the demo goes to Printables comments on a popular temperature tower model instead, under the same rules.
Search partially supports the need (feature requests, silent-failure threads) but cannot show that users would switch flows.

## Kill criteria
- Stop by 2026-11-15 if TSK-001 refutes the riskiest assumption: fewer than 5 counted replies (as defined above) across the Prusa forum and r/prusa3d within 14 days, or replies mostly recommending OrcaSlicer.
- Stop early if TSK-001 finds an existing tool that already gives PrusaSlicer users a tower with matching labels and a verified G-code change.
- Stop if, by 2027-04-15, fewer than 20 G-code processing events are counted and the PrusaSlicer community posts no "this solved my problem" reply from a distinct account.
