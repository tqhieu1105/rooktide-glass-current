# Checkpoint 1 — BLOCKED at Three.js vendoring

Time: 2026-11-21 02:29 UTC. Branch: `main`.
Baseline commit: `112b3679324ad0844765a8197b2275b6d6a0c55a`.

**Milestone 1 is not complete. No 3D screenshot exists, no render verification
passed, and no milestone commit or push was made.**

## Completed work

- Read the build plan, research targets, submission/experiment/feel inputs,
  official kit rules, and archived mission data, vehicle tuning, effects and
  all four scenario setups. `RESEARCH-ARCH.md` is absent.
- Rewrote `README.md` as the first successful file edit in this session,
  covering the premise, six districts, crew, planned controls/systems and
  delivery commands. Revised it to state this blocker truthfully.
- Confirmed the existing recorder process is running (PID `21255`), with
  recording ID `01a1fbdd-ebaa-75cf-9e45-503ede4bff45`. Its leaves file grew
  during this session. No recorder or submission command was run.

## Exact blocking failure

Attempted to vendor the plan's pinned, self-contained renderer:

```sh
mkdir -p game/vendor
curl -fL --connect-timeout 15 --max-time 45 \
  https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js \
  -o game/vendor/three.module.min.js
```

The command returned exit status 6:

```text
curl: (6) Could not resolve host: cdn.jsdelivr.net
```

This session has restricted network access and approval policy `never`.
The user explicitly requires stopping if Three.js vendoring fails, so
implementation stopped at this point. The empty `game/vendor/` directory
is not a successful vendoring result. No fallback renderer was authored.
The starter game, screenshots, `main.ts` and `vendor/makefun-game.ts` remain
unchanged. The existing starter screenshots do not prove a 3D build.

## Screenshot proof and running

Screenshot proof path: **none — gate not reached**.
Visual verdict: **unverified, milestone failed at dependency setup**.

The eventual development command is `node serve.ts` with
`http://127.0.0.1:8080`. No server was created or started in this session;
`serve.ts` is absent from this baseline. The required package command is
`MAKEFUN_OUTPUT_DIR=out node main.ts`; it was not run because the explicit
dependency stop rule fired before implementation and verification.

## Handover

Recording still alive: **yes**, PID `21255` at the checkpoint check.
Leave it running as requested. The session did not stop or restart it.

Next task: provide working dependency network access (or the authentic
Three.js 0.160.0 `three.module.min.js` and matching MIT license), then start
a fresh witnessed build session. Build only milestone 1: genuine WebGL city,
six districts, on-foot player, one car, enter/exit and chase camera. Take
and inspect a real headless Chromium screenshot with zero console errors
before packaging, committing and pushing.

The requested external handover path is
`/data/home/makefun/gta6-01/CHECKPOINT-1.md`. That parent directory is outside
this session's writable roots. This copy is preserved inside the writable
repository; the operator must place it at the external handover path.
The sandbox also makes `.git` read-only, so a fresh implementation session
must have permission to commit and push to satisfy the milestone's final
step. No permission escalation is available in this session.
