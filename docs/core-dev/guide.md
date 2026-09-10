# Core Developer Guide

This guide is for contributors who work on DevToolBox core (Electron main/preload/renderer) and built-in tool modules.

## Prerequisites

- Node.js 20 (see `.nvmrc`)
- pnpm 10

## Install and Run (Development)

```bash
pnpm install
pnpm dev
```

## Quality Gates

```bash
pnpm format:check
pnpm lint
pnpm lint:modules
pnpm typecheck
pnpm test
```

## Repository Layout

```text
devtoolbox/
├── core/                 Electron app (main + preload + renderer)
├── core/packages/        Shared packages (@devtoolbox/core, @devtoolbox/ui)
├── marketplace/          Marketplace workspace (plugin source + packaging scripts)
├── docs/                 Documentation source for MkDocs
└── scripts/              Repo tooling (lint/scaffold/release helpers)
```

## Architecture Model

DevToolBox follows the standard Electron split:

- main process: privileged OS / network / filesystem operations
- preload: safe API bridge (`window.electronAPI`)
- renderer: React UI (built-in modules + plugin host)

For deeper details:

- [Architecture](architecture.md)
- [IPC API](ipc-api.md)

## Built-in Tool Modules

Built-in tools are auto-discovered under:

- `core/renderer/components/ModuleTools/**/config.tsx`

Recommended structure:

```text
core/renderer/components/ModuleTools/MyTool/
├── config.tsx
├── index.tsx
└── MyTool.module.css
```

Reference:

- [Built-in Modules](built-in-modules.md)
- [Module API](module-api.md)

## IPC Workflow

Recommended pattern:

1. Add handler in main process (`core/main/ipc/*`)
2. Expose a safe method in preload (`core/main/preload/index.ts`)
3. Update renderer typing (`core/renderer/types/electron.d.ts`)
4. Call `window.electronAPI` in the renderer

Reference:

- [IPC API](ipc-api.md)

## Marketplace (Host Side)

The core app hosts marketplace plugins via an iframe bridge:

- Plugin UI runs in iframe (isolated)
- Plugin calls host via SDK request/response
- Host enforces permissions for every SDK call

Reference:

- [Plugin SDK Contract](../plugin-dev/sdk.md)
- [Marketplace Packaging](../plugin-dev/packaging.md)

## Packaging (App Installers)

From the repo root:

```bash
pnpm package:mac
pnpm package:win
```

## Troubleshooting

- [Troubleshooting](../shared/troubleshooting.md)

## Contribution and Security

- [Contributing](../governance/contributing.md)
- [Security](../governance/security.md)
