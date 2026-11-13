---
id: LRN-005
title: gh pr checks --watch returns before CI registers
status: active
tags: [ci, github, tooling]
task: TSK-012
created: 2026-11-13
---

## Context

Shipping tasks one PR at a time with `gh pr checks <n> --watch` then `gh pr merge --squash`.

## Learnings

- Right after a push (especially a force-push after a rebase), `gh pr checks --watch` reports "no checks reported" and exits at once, so a chained merge lands before PR CI runs (#15). Poll until `gh pr checks` lists the `check` row, then watch.
- Every flowstate task move rewrites `.backlog/tasks/index.md`, so stacked task branches conflict there on rebase; take either side and run `flowstate index-rebuild`.

## Applies to

The PR-per-task merge loop in this repo.
