# Slicer-Agnostic Temperature Tower Generator

A free, 100% client-side browser tool for PrusaSlicer users tuning a new filament.

1. Pick a material preset and a temperature range; download a labelled tower STL.
2. Slice the STL in PrusaSlicer with your own profile.
3. Upload the G-code, plain `.gcode` or binary `.bgcode` (Core One, MK4S, XL, MINI); the page inserts one temperature command per tier, shows every change (temperature-vs-Z chart, inserted and neutralized lines, warnings) and only then offers the download in the same format.

Nothing leaves your device. The only network request is an optional anonymous "file processed" counter in production builds (see `docs/adr/0001-client-side-only-processing.md`).

## Development

```sh
pnpm install
pnpm dev        # Vite dev server
pnpm test       # unit, property, geometry and fixture suites
pnpm typecheck
pnpm build      # static site in apps/web/dist
```

See `AGENTS.md` for the layout, the fixture workflow and the project rules, and `docs/` for the evaluation and the architecture decisions.

## Status

Phase 1 (PrusaSlicer, plain or binary G-code, Marlin/Prusa/Klipper dialect). Binary G-code is decoded, transformed as text and re-encoded with the metadata and thumbnails copied byte-for-byte (`docs/adr/0007-binary-gcode-decode-transform-reencode.md`). Arc moves (`G2`/`G3`) are ordinary moves (`docs/adr/0008-arc-moves-supported-in-phase-1.md`), so stock Core One and 3.0 profiles work unchanged.
