# Slicer-Agnostic Temperature Tower Generator

**[Open the tool](https://jmlweb.github.io/temperature-tower-generator/)** · free, no install, no account

PrusaSlicer has no built-in temperature tower. This browser tool generates a labelled tower STL, then rewrites the G-code you sliced with your own profile so each tier prints at its own temperature. It shows every change before you download.

The steps:

1. Pick a material preset and a temperature range; download a labelled tower STL.
2. Slice the STL in PrusaSlicer with your own profile.
3. Upload the G-code, plain `.gcode` or binary `.bgcode` (Core One, MK4S, XL, MINI); the page inserts one temperature command per tier, shows every change (temperature-vs-Z chart, inserted and neutralized lines, warnings) and only then offers the download in the same format.

## Privacy

Your G-code, STL and settings are never uploaded. The only network request is one anonymous "file processed" count when you click the modified G-code download, in production builds only (`docs/adr/0001-client-side-only-processing.md`).

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

## Problems and feedback

If a G-code file is rejected or tiers land on the wrong layer, [open an issue](https://github.com/jmlweb/temperature-tower-generator/issues/new/choose) and attach the file. Reports like this decide whether other slicers are added.

## License

[MIT](LICENSE)
