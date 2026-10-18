# 0005. One tower config drives both geometry and transform

**Status:** accepted

## Context
Labels that drift from the tested temperatures are a core pain: users re-use a fixed STL with a different range, or change the block height in one place but not the other. The tower STL is generated before slicing and the G-code is transformed after it, so the two steps happen minutes apart. The uploaded G-code's name comes from the slicer's output filename format. PrusaSlicer's default format starts with the input file's base name, but users can change it.

## Decision
A single typed tower config (material, start/end temperature, step, block height, base height, wait-for-temperature flag) is the only input to both the geometry generator and the G-code transform. The config is encoded in the STL base name in a reversible, versioned format. When G-code is uploaded, the config is recovered in this order: the G-code file name, then the object name in the G-code's object-label comments, then manual entry.

## Consequences
- Labels and inserted temperatures come from the same values, which a test can assert.
- Tier boundaries in geometry (`b + i·h`) and in the transform use the same formula and the same rounding.
- The object-name fallback works only when the printer profile labels objects; the tool never asks users to enable it. Manual entry is a first-class path, with its own UI and tests, not an error state.
- The filename format becomes a compatibility contract: changing it needs a new version marker.
