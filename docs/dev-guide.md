# Development Guide

This document describes how to build, test, and extend DevToolBox.

## Prerequisites

- Node.js 20 (see `.nvmrc`)
- pnpm 10

## Install & Run

```bash
pnpm install
pnpm dev
```

## CLI

For contributors, `cli.sh` provides a unified command entry (dev/build/package/check/marketplace).
See [cli.md](./cli.md).

## Quality Gates

```bash
pnpm format:check
pnpm lint
pnpm lint:modules
pnpm typecheck
pnpm test
```

## Adding a Tool Module

Tool modules are auto-discovered under:

`core/renderer/components/ModuleTools/**/config.tsx`

Minimum structure:

```text
core/renderer/components/ModuleTools/MyTool/
├── config.tsx
├── index.tsx
└── MyTool.module.css
```

Example config:

```ts
import type { ModuleConfig } from '../../../types';
import MyTool from './index';

const config: ModuleConfig = {
  id: 'core-my-tool',
  name: 'My Tool',
  description: 'Short description',
  categoryId: 'dev-tools',
  component: MyTool,
};

export default config;
```

Notes:

- Built-in module `id` must start with `core-`.
- Available `categoryId` values are defined in `core/renderer/data/placeholder.ts` (for example: `dev-tools`, `text-tools`, `network-tools`, `security-tools`, `other-tools`).

## Adding IPC

Recommended workflow:

1. Add handler in main process (`core/main/ipc/*`).
2. Expose a safe method in preload (`core/main/preload/index.ts`).
3. Update renderer typing (`core/renderer/types/electron.d.ts`).
4. Use `window.electronAPI` in the renderer.

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md).
