# 0006. Parametric CSG mesh generation in the browser

**Status:** accepted

## Context
The tower must match the user's chosen range, step and block height, with readable temperature labels on each block (ADR-0005). Fixed STL downloads cannot do that, and the project has no server (ADR-0001). Each block needs test features (45° overhang, short bridge, stringing pillar) and a label at least 5 mm tall.

## Decision
The tower is built in the browser by constructive solid geometry over solid primitives, plus text outlines extruded into solids. One block per tier is stacked at `b + i·h` on a base plate, and the result is written as a binary mesh file.

## Consequences
- Any valid config yields a matching tower without stored models.
- Geometry is testable: the mesh is manifold, its height is `b + n·h`, and it has one label per tier with the tier's temperature.
- The CSG and font code adds a WASM payload to the page; it loads only when the user generates a tower.
- Ruled out: pre-made STL variants and server-side model generation.
