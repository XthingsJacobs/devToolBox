# Project Rules for Agents

These instructions apply to automated coding agents and contributors working in this repository. `AGENT.md` and `AGENTS.md` intentionally contain the same content so different tools can discover the project rules on any machine.

## Repository Overview

DevToolBox is an Electron desktop application with a React renderer, typed preload bridge, built-in tools, and a sandboxed Marketplace plugin runtime.

Main areas:

- `core/main/`: Electron main process, IPC handlers, diagnostics, startup health, Marketplace services, native modules, and preload.
- `core/renderer/`: React app, pages, built-in tools, services, themes, i18n, and plugin host.
- `core/packages/core/`: shared manifest types, plugin types, and Electron IPC contracts.
- `core/packages/ui/`: shared UI primitives and styles.
- `core/packages/plugin-sdk/`: Marketplace Plugin SDK package.
- `marketplace/`: local Marketplace plugin sources, shared build config, pack/sign/verify scripts.
- `docs/`: English documentation plus locale mirrors such as `docs/zh-CN/`.
- `scripts/`: validation, smoke tests, scaffolding, bundle, docs, and supply-chain checks.
- `cli.sh`: unified contributor CLI.

## Required Local Environment

Use the versions pinned by the repository. Do not rely on a newer local Node version for development or release work.

- Node.js: `20.x` from `.nvmrc` (`package.json` requires `>=20 <21`).
- pnpm: `10.x`, pinned as `pnpm@10.10.0`.
- Git.
- Electron packaging must generally run on the target OS.

Fresh-machine setup:

```bash
cd /path/to/DevToolBox
nvm use
corepack enable
corepack prepare pnpm@10.10.0 --activate
pnpm install
./cli.sh doctor
```

If `cli.sh` is not executable after checkout:

```bash
chmod +x ./cli.sh
```

Node 26 or other unsupported versions may typecheck in some cases but can break packaging or native dependency install. Switch to Node 20 before packaging or release validation.

## Common Commands

Prefer the repository CLI for routine workflows:

```bash
./cli.sh doctor
./cli.sh dev
./cli.sh build
./cli.sh check
./cli.sh tool new
./cli.sh plugin create
./cli.sh plugin <market-id>
./cli.sh plugin all
./cli.sh package macos arm64
./cli.sh package windows
```

Equivalent focused pnpm commands:

```bash
pnpm lint
pnpm lint:modules
pnpm lint:boundaries
pnpm lint:docs
pnpm typecheck
pnpm test
pnpm build
pnpm bundle:check
pnpm -C marketplace bundle:check
```

`./cli.sh dev` auto-selects a free Vite port if `5173` is occupied. Useful environment variables:

- `DEVTOOLBOX_DEV_PORT=5174 ./cli.sh dev` to prefer another dev port.
- `DEVTOOLBOX_STRICT_PORT=1 ./cli.sh dev` to fail instead of auto-selecting another port.
- `DEVTOOLBOX_ALLOW_UNSUPPORTED_NODE=1` only for temporary diagnostics, not release work.

## Validation Expectations

Before pushing meaningful code changes, run at least:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm bundle:check
```

For release-sensitive, preload, renderer boot, or packaging changes, also run after `pnpm build`:

```bash
pnpm test:renderer
pnpm test:electron
```

Known test output: `pnpm test` may print `formatter crashed` from `core/renderer/components/ToolsPage/__tests__/error-boundary.test.tsx`. That is an intentional error-boundary test and is acceptable when Vitest still reports all tests passing.

Use `git diff --check` before committing to catch whitespace issues.

## Git Rules

- Write all Git commit messages in English.
- Prefer concise Conventional Commit style, for example `feat: add plugin SDK release checks`.
- Keep commits grouped by functional area when a change spans multiple concerns.
- Do not rewrite already-pushed history unless the user explicitly requests it.
- Do not commit secrets, local credentials, private keys, certificates, or generated release artifacts unless the task explicitly requires them.
- Do not run destructive commands such as hard resets or broad cleanups unless explicitly requested.

## Architecture Boundaries

Respect the process boundaries. This repository has automated checks for many of them.

### Main Process

- Keep privileged work in `core/main/`.
- Validate all IPC input in the main process; renderer validation is only for user experience.
- Return serializable structured results. Prefer explicit result objects over throwing across process boundaries.
- Marketplace privilege checks belong in `core/main/marketplace/` and `core/main/ipc/plugin-capabilities.ts`.

### Preload and Electron API

- The canonical Electron API and IPC contracts live in `core/packages/core/src/electron-api.ts`.
- `core/main/preload/index.ts` exposes only narrow methods through `contextBridge`.
- Raw `ipcRenderer.invoke/send/on/removeListener` must remain inside typed preload helpers.
- When adding a privileged operation, update all related layers:
  1. main-process handler and validation,
  2. shared contract in `core/packages/core/src/electron-api.ts`,
  3. preload mapping,
  4. renderer service or consumer,
  5. tests for contract drift.

### Renderer

- Renderer code must not import Node, Electron, or main-process modules.
- Renderer components should use `core/renderer/services/*`, not direct `window.electronAPI` calls.
- Only `core/renderer/lib/electron.ts` should directly read `window.electronAPI`.
- Generated HTML must render through `core/renderer/components/SafeHtml/`; do not add direct `dangerouslySetInnerHTML` elsewhere.
- Clean up timers, workers, streams, and IPC listeners when React components unmount.

### Module Tools

- Built-in tools live under `core/renderer/components/ModuleTools/<ToolName>/`.
- Keep tool entry files small; split logic into `.model.ts`, hooks, panes, and shared helpers.
- Model files must stay pure: no React/UI imports and no `window.*` access.
- Reuse `core/renderer/components/ModuleToolShared/` for CodeMirror, highlighting, and shared editor behavior.
- Run `pnpm lint:boundaries` after refactors; it enforces important size and dependency constraints.

## Marketplace and Plugin SDK

- Plugin sources live in `marketplace/modules/<market-id>/`.
- Use `@devtoolbox/plugin-sdk` instead of duplicating SDK shims inside plugins.
- Shared Marketplace Vite config lives in `marketplace/shared/vite.config.ts`.
- Build and pack local plugins with:

```bash
./cli.sh plugin <market-id>
./cli.sh plugin all
```

- Release packages must pass provenance, checksum, manifest, and bundle checks.
- Plugin iframes are sandboxed. Do not expose Electron or Node APIs directly to plugin code.
- Every privileged SDK call must be permission-checked by the capability broker.

Plugin SDK checks:

```bash
pnpm --filter @devtoolbox/plugin-sdk typecheck
pnpm --filter @devtoolbox/plugin-sdk build
pnpm --filter @devtoolbox/plugin-sdk pack:check
```

## Documentation and Localization

- English documentation is the default and lives directly under `docs/`.
- Chinese Simplified documentation mirrors English paths under `docs/zh-CN/`.
- When changing an English page, update the matching translation in the same task or explicitly document that translation is pending.
- Keep code, command names, file paths, manifest fields, permission names, and error codes unchanged in translations.
- Update `docs-site/mkdocs.yml` when adding, moving, or removing documentation pages.
- Run `pnpm lint:docs` after documentation changes.

## UI and Theme Work

- Preserve the existing design system and visual language unless the task explicitly asks for a redesign.
- Light-mode changes should use semantic variables in `core/renderer/theme/variables.css` and component CSS modules.
- Do not reintroduce global `user-select: none` patterns that block text selection in editors, JSON/code output, or text fields.
- Verify both desktop and narrow/mobile layouts when changing settings, dashboard, module cards, or tool panels.

## Packaging and Release Notes

Packaging examples:

```bash
./cli.sh package macos arm64
./cli.sh package macos x64
./cli.sh package macos universal
./cli.sh package windows
./cli.sh package all
```

Packaging runs build, bundle validation, and supply-chain generation. If packaging is killed by the OS, first check memory/disk with `./cli.sh doctor`, close memory-heavy apps, and ensure Node 20 is active.

## Safety Notes for Agents

- Treat the worktree as user-owned. Do not revert unrelated changes.
- If unexpected changes appear while working, stop and ask how to proceed.
- Prefer `rg` for searches when available; use safe alternatives if it hangs or is unavailable.
- Do not add broad generated output to commits unless it is explicitly part of the requested deliverable.
- Keep final responses concise, list files changed, tests run, and any remaining risk.
