# AGENTS.md

Slicer-Agnostic Temperature Tower Generator is a free, 100% client-side browser tool for hobbyist FDM owners tuning a new filament. It generates a labelled parametric temperature tower STL, then rewrites the user's own sliced G-code with per-tier temperatures. Every change is shown before download. "Slicer-agnostic" describes the core design (ADR-0003); Phase 1 supports PrusaSlicer only, because PrusaSlicer has no built-in tower. The goal is community adoption: 100 G-code processing events or 50 GitHub stars by 2027-04-15, after a launch by 2027-01-15.

## Map
- `packages/core/src` — `gcode-file.ts` (upload decoding: plain text or `.bgcode`), `bgcode/` (binary G-code codec: container `format.ts`, `codec.ts` decode/re-encode, `meatpack.ts`, `heatshrink.ts`, `inflate.ts`, `crc32.ts`, `utf8.ts`; ADR-0007), `gcode-lines.ts` (parser keeping raw text and endings), `motion.ts` (motion state, layers), `slicers/` (PrusaSlicer reader and registry, fed by comments or binary metadata), `validation.ts` (ADR-0004 checks), `transform.ts` (line-preserving transform, tier placement, inline or own-line tier marker), `report.ts`, `tower-config.ts` (config, presets, `tierBoundaryZ`), `filename-codec.ts`, `recover-config.ts`, `process.ts` (pipeline). No DOM; `test/no-dom.test.ts` enforces it (the word check also rejects comments, so avoid the bare words `window` and `document` in core sources).
- `packages/geometry/src` — `tower.ts` (CSG tower via `manifold-3d`), `font.ts` (5x7 digit bitmaps for labels), `stl.ts` (binary STL writer and reader), `mesh-checks.ts` (manifold check, height, label raster read-back).
- `apps/web/src` — `main.ts` (three steps: config and STL, upload, report and download), `config-form.ts`, `report-view.ts`, `chart.ts`, `workers/gcode.worker.ts` and `workers/tower.worker.ts`, `worker-client.ts`, `counter.ts` and `counter-policy.ts` (ADR-0001 beacon).
- `fixtures/prusaslicer/` — `<variant>.gcode` (or `.bgcode`) plus `<variant>.config.json` (tower config, expected codes, optional `gcode` to share or name the input), with `<variant>.golden.gcode` (transformed text, decoded for binary input) and `<variant>.report.json` written by the fixture command. `fixtures/fixtures.test.ts` runs them and, for binary input, checks the re-encoded output decodes to the golden with every non-G-code block byte-for-byte.
- `scripts/slice-fixtures.ts` — regenerates the fixtures by slicing the tower STL with the PrusaSlicer CLI; also writes the synthetic ones. `scripts/bgcode-from-text.ts` converts a text export to `.bgcode` like libbgcode's converter, because the 3.0 CLI cannot export binary (LRN-002).
- `docs/` — evaluation, overview, ADRs.

## Commands
- `pnpm install` — Node 24 and pnpm 10. Workspace packages export TypeScript source; nothing is compiled except the web app.
- `pnpm dev` / `pnpm build` / `pnpm preview` — Vite dev server, static build to `apps/web/dist`, and preview of the build.
- `pnpm test` — all suites (unit, property, geometry, fixtures). `pnpm typecheck` runs `tsc` per package.
- `pnpm fixture` — runs every fixture and writes or updates its golden output and report snapshot (`vitest --update` over `fixtures/`). Review the diff by hand, as the add-fixture skill says.
- `pnpm slice-fixtures` — re-slices the fixture inputs with PrusaSlicer (`PRUSA_SLICER` env var, default `/Applications/PrusaSlicer-3.0.0-alpha12.app/Contents/MacOS/PrusaSlicer`). Add `--synthetic-only` to rewrite only the hand-shaped fixtures, or `--only <variant>` for one slice. Re-sliced files carry a new timestamp, so run `pnpm fixture` after.
- `BGCODE_REFERENCE_DIR=<dir> pnpm test` — also checks the codec against libbgcode's `tests/data` files (not vendored, AGPL); `packages/core/test/bgcode-reference.test.ts` skips without it.
- Counter: set `VITE_COUNTER_URL` (see `apps/web/.env.example`) at build time; unset means no event.

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
- Every validation check is in the `error` or `warning` list of ADR-0004 (with the binary line replaced by `binary-gcode-unreadable`, ADR-0007), and has a fixture that triggers it. An `error` fixture produces no output file (ADR-0004).
- The download control is reachable only after the report renders (ADR-0004).
- Output G-code starts with a `; [temptower]` header block holding the tool version, tower config and change summary (ADR-0004).
- A `.bgcode` upload is decoded in the worker by the pure TypeScript codec in `packages/core/src/bgcode`; the transform runs on the decoded text, and the output is re-encoded with every non-G-code block copied byte-for-byte and the input's G-code compression and encoding (ADR-0007).
- In binary output the tier marker is its own comment line `; [temptower] tier <i>` before a bare `M104`/`M109`, because MeatPack drops inline comments; the ADR-0002 property test runs over the decoded text of a binary input too (ADR-0007).
- Geometry and transform read tier boundaries from one shared function over the tower config; no second implementation of `b + i·h` exists (ADR-0005).
- The STL base name encodes the tower config, and a round-trip test proves encode/decode is lossless (ADR-0005).
- Config recovery has tests for three cases: a G-code name that keeps the STL base name, a renamed G-code with object-label comments, and neither (manual entry) (ADR-0005).
- Geometry tests assert that the mesh is manifold, its height is `b + n·h`, and each tier's label shows that tier's temperature (ADR-0006).

## Decisions
See `docs/adr/`. A change that contradicts an accepted ADR adds a new ADR first.
