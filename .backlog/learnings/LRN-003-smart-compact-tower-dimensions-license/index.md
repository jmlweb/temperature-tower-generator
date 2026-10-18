---
id: LRN-003
title: Smart Compact tower dimensions, license, and why the CSG union needs vertex welding
status: active
tags: [geometry, tower, manifold, stl, licensing]
task: 
created: 2026-10-18
---

## Context

Reshaping the parametric tower in `packages/geometry/src/tower.ts` after gaaZolee's Smart Compact temperature tower, so the generated STL looks like the one users already know. Dimensions were measured from the Printables 316034 STL (downloaded through the Printables GraphQL API, since the HTML page returns 403 to scripts).

## Insight

- Licensing: the Printables 316034 remix is CC BY-NC. The original (Thingiverse 2729076) and the copy SuperSlicer ships under `resources/calibration/filament_temp/` are CC BY-SA 3.0. Neither mesh can be embedded; the functional feature layout can be mirrored with our own geometry.
- Measured geometry: plate 47 x 28 mm, base 1.4 mm, blocks 10 mm, tiers about 10 mm deep, 8 tiers from 225 C at the bottom to 190 C at the top (hot first; the tiers labelled 210 and 215, whose "1" is straight, have the fewest label triangles, which pins the order). Features left to right: 45° overhang eave with a 9 mm run and flat top, bridge on two pillars, stringing cones, label body with digits on the front face.
- SuperSlicer places the temperature changes at `i * 10 * xyzScale` with `M104`, hottest tier first, same convention as ours.
- manifold-3d emits two vertices a rounding error apart where a flush face meets another part's edge (the eave top on the bridge deck). In double precision the union is manifold; cast to float32 for the STL, the two vertices collapse to the same position and leave degenerate triangles, so the position-based `isManifold` check fails. Insetting the eave into the pillar does not help; the coincidence is on the shared top plane.

## Application

- Keep `weldMesh` in `tower.ts`: merge vertices by float32 position and drop collapsed triangles after every `Manifold.union`. Any new feature with a top face flush to a neighbour's top face will hit the same issue.
- A G-code sliced from the real Smart Compact STL matches the PLA preset (225 to 190, step 5, block 10, base 1.4) with no manual entry.
- Prefer the Printables GraphQL endpoint (`https://api.printables.com/graphql/`, `print(id:)` and `getDownloadLink(printId:, id:, fileType: stl, source: model_detail)`) over scraping the page.
