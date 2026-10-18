# 0001. Client-side only processing on static hosting

**Status:** accepted

## Context
The project has a €0 budget, ~5 h/week of maintenance time and a community goal. Users upload G-code tied to their own printer, and the plan promises "no install, no server". A backend would add cost, an operations burden and a privacy question, and none of the work needs one: tower generation and G-code rewriting are deterministic functions of the user's input. The success metric still needs a count of processing events.

## Decision
All processing (tower geometry, G-code analysis, transformation, validation) runs in the user's browser, served as static assets. The project runs no first-party server code. Its only runtime dependency is a free-tier, cookieless, third-party event counter. The page sends one anonymous "file processed" event each time the user triggers the modified G-code download. It never sends file contents, file names or tower config. Development and test builds send no events.

## Consequences
- Hosting is free and needs no operations; user files never leave the device.
- The success metric is measurable without accounts, as a count of downloads of transformed G-code (not distinct files or users).
- Large G-code files must be handled within browser memory limits.
- If the counter's free tier disappears, only the metric is lost; the tool keeps working.
- Ruled out: server-side slicing, cloud storage, accounts, and any feature that needs shared state.
