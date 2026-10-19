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
- Measured geometry: dogbone plate 43 x 28 mm (x 3.8 to 46.7, 28 mm pads at both ends, 10 mm waist), base 1.4 mm, blocks 10 mm, tiers 45 x 10 mm, 8 tiers from 225 C at the bottom to 190 C at the top (hot first; the tiers labelled 210 and 215, whose "1" is straight, have the fewest label triangles, which pins the order).
- Each tier is one solid bar with cut-outs, not separate features. Left to right: a variable-angle overhang under the left end (underside polyline from (9.5, 0) through (7.24, 3.9), (4.41, 6.73), (1.81, 8.23) to (0, 9.07): 30°, 45°, 60°, 65° from vertical, 0.9 mm lip); a through window z 4.7 to 9.2 (0.8 mm deck) from x 33.5 back to a wall that runs diagonally in plan from x 3.5 at the front to x 18.5 at the back, so the bridge span grows from 15 to 30 mm; a keyhole through the depth (circle r 3.87 at x 38.9, z 5.3, slot 2.4 wide down to z 1.0) with a spike inside (r about 1.2 at the base, apex z 8.7); a rounded nose from x 41 to 44.5; 0.4 mm chamfers on the long edges; digits engraved 0.6 mm into the front face, 3.7 mm tall, x 21.5 to 30.
- Coarse vertex rasters mislead: the first reading of this model as "eave, bridge pillars, cones, label body" was wrong. Render depth maps (z-buffer) and group faces by normal and position before copying a layout.
- SuperSlicer places the temperature changes at `i * 10 * xyzScale` with `M104`, hottest tier first, same convention as ours.
- manifold-3d emits two vertices a rounding error apart where a flush face meets another part's edge (the eave top on the bridge deck). In double precision the union is manifold; cast to float32 for the STL, the two vertices collapse to the same position and leave degenerate triangles, so the position-based `isManifold` check fails. Insetting the eave into the pillar does not help; the coincidence is on the shared top plane.

## Application

- Keep `weldMesh` in `tower.ts`: merge vertices by float32 position and drop collapsed triangles after every `Manifold.union`. Any new feature with a top face flush to a neighbour's top face will hit the same issue.
- A G-code sliced from the real Smart Compact STL matches the PLA preset (225 to 190, step 5, block 10, base 1.4) with no manual entry.
- Prefer the Printables GraphQL endpoint (`https://api.printables.com/graphql/`, `print(id:)` and `getDownloadLink(printId:, id:, fileType: stl, source: model_detail)`) over scraping the page.
