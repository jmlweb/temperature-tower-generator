# AGENTS.md

Slicer-Agnostic Temperature Tower Generator is a free, 100% client-side browser tool for hobbyist FDM owners tuning a new filament. It generates a labelled parametric temperature tower STL, then rewrites the user's own sliced G-code with per-tier temperatures. Every change is shown before download. "Slicer-agnostic" describes the core design (ADR-0003); Phase 1 supports PrusaSlicer only, because PrusaSlicer has no built-in tower. The goal is community adoption: 100 G-code processing events or 50 GitHub stars by 2027-04-15, after a launch by 2027-01-15.

## Map
None yet. Planned layout:
- `packages/core` — G-code parser, motion state, layer detection, config readers, transform, validation (no DOM)
- `packages/geometry` — parametric tower and labels to binary STL
- `apps/web` — config, upload, report, preview chart, download
- `fixtures/` — sliced G-code inputs with golden outputs and report snapshots
- `docs/` — evaluation, overview, ADRs

## Commands
To be defined in the first implementation task (stack: TypeScript strict, pnpm workspace, Vite for `apps/web`). That task adds a command that runs the transform on one fixture and writes its golden output and report snapshot.

## Rules
- No code path sends G-code, STL, file names or tower config over the network; the only outbound request is the anonymous "file processed" event to the counter endpoint (ADR-0001).
- The counter event fires exactly once per click on the modified G-code download, and never in development or test builds (ADR-0001).
- No first-party server code or API routes exist; the counter endpoint is the only runtime dependency (ADR-0001).
- `packages/core` imports no DOM or browser-only API (`window`, `document`, `Blob`, `Worker`) (ADR-0002).
- Parsing and transformation run in a Web Worker, never on the UI thread (ADR-0002).
- Each output line differs from the input only in one of three ways (ADR-0002). A property test enforces it.
  - An inserted tier command ends with ` ; [temptower] tier <i>`.
  - An inserted header line starts with `; [temptower]`.
  - A neutralized input line is prefixed with `; [temptower] neutralized: `.
  - All other input lines appear byte-for-byte.
- Only `M104`/`M109` lines (including `T`-indexed variants) whose layer Z is at or above the first tier boundary are neutralized. Start G-code and lines below the first tier boundary are kept. A fixture covers both cases (ADR-0002).
- Layer boundaries come from motion state; slicer markers never override them and a disagreement emits a warning (ADR-0003).
- Every supported G-code feature (Z-hop, relative E, `G92 E0`) has at least one fixture with a golden output (ADR-0003).
- The slicer reader registry in `packages/core` holds only the PrusaSlicer reader until Phase 2 starts. Phase 2 starts after the first external failing-G-code report is triaged (ADR-0003).
- Every validation check is in the `error` or `warning` list of ADR-0004, and has a fixture that triggers it. An `error` fixture produces no output file (ADR-0004).
- The download control is reachable only after the report renders (ADR-0004).
- Output G-code starts with a `; [temptower]` header block holding the tool version, tower config and change summary (ADR-0004).
- Geometry and transform read tier boundaries from one shared function over the tower config; no second implementation of `b + i·h` exists (ADR-0005).
- The STL base name encodes the tower config, and a round-trip test proves encode/decode is lossless (ADR-0005).
- Config recovery has tests for three cases: a G-code name that keeps the STL base name, a renamed G-code with object-label comments, and neither (manual entry) (ADR-0005).
- Geometry tests assert that the mesh is manifold, its height is `b + n·h`, and each tier's label shows that tier's temperature (ADR-0006).

## Decisions
See `docs/adr/`. A change that contradicts an accepted ADR adds a new ADR first.
