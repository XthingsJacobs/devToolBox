# DevToolBox — Cross-platform Desktop Toolbox

[![CI](https://github.com/XthingsJacobs/devToolBox/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/XthingsJacobs/devToolBox/actions/workflows/ci.yml)
[![CodeQL](https://github.com/XthingsJacobs/devToolBox/actions/workflows/codeql.yml/badge.svg?branch=dev)](https://github.com/XthingsJacobs/devToolBox/actions/workflows/codeql.yml)
![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)

DevToolBox is a cross-platform desktop toolbox built with Electron + React + TypeScript + Vite. It provides a workspace-style dashboard, global search, and a growing set of developer utilities.

## Quick Start

```bash
pnpm install

pnpm dev

# Or use the unified CLI wrapper:
# chmod +x ./cli.sh
# ./cli.sh dev

pnpm lint
pnpm lint:modules
pnpm typecheck
pnpm test

pnpm build

pnpm package:mac
pnpm package:win
```

## Contributing

- Contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Development guide: [docs/dev-guide.md](./docs/dev-guide.md)
- Marketplace plugin SDK: [docs/plugin-sdk.md](./docs/plugin-sdk.md)
- Troubleshooting: [docs/troubleshooting.md](./docs/troubleshooting.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](./SECURITY.md)

## Repository Layout

```text
devtoolbox/
├── core/                              # Electron app (main + preload + renderer)
│   ├── packages/
│   │   ├── core/                      # Stable types and core conventions
│   │   └── ui/                        # Shared UI components & hooks
├── docs/                              # Developer documentation
├── docs-site/                         # MkDocs Material site config
├── marketplace/                       # Marketplace plugins workspace
├── scripts/                           # Repo tooling (lint modules / scaffolding)
├── package.json
└── pnpm-workspace.yaml
```

## Add a New Tool Module

Tool modules are auto-discovered via `import.meta.glob`. Create a folder under `core/renderer/components/ModuleTools/` and include a `config.tsx`.

```text
core/renderer/components/ModuleTools/MyTool/
├── index.tsx
├── MyTool.module.css
└── config.tsx
```

Example `config.tsx`:

```ts
import type { ModuleConfig } from '../../../types';
import MyTool from './index';

const config: ModuleConfig = {
  id: 'my-tool',
  name: 'My Tool',
  description: 'Tool description',
  categoryId: 'dev-tools',
  component: MyTool,
};

export default config;
```

## License

Apache-2.0
