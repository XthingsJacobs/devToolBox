# DevToolBox — Plugin-first, all-in-one Desktop Toolbox

[![CI](https://github.com/XthingsJacobs/devToolBox/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/XthingsJacobs/devToolBox/actions/workflows/ci.yml)
[![CodeQL](https://github.com/XthingsJacobs/devToolBox/actions/workflows/codeql.yml/badge.svg?branch=dev)](https://github.com/XthingsJacobs/devToolBox/actions/workflows/codeql.yml)
![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)

DevToolBox is a cross-platform desktop toolbox built with Electron + React + TypeScript + Vite.

It aims to be a plugin-first, all-in-one workspace for everyday developer utilities:

- Built-in tool modules: formatter, codec, crypto, network, MQTT, JWT, diff, etc.
- Marketplace plugins: install, update, and build your own tools as plugins
- One app, one search, one workspace: keep common utilities together instead of scattered scripts

## Get Started (Users)

- Download: https://github.com/XthingsJacobs/devToolBox/releases
- Install plugins: Modules → Marketplace → Refresh → Install
- User docs: [docs/index.md](./docs/index.md) → [users/guide.md](./docs/users/guide.md)

## Featured Tools

Built-in tool modules worth trying first:

- Markdown Preview
- QR Code Generator
- MQTT Tool

Marketplace plugins in this repo (examples):

- `market-ip-lookup`: IP geolocation lookup with multi-provider fallback
- `market-exchange-rate`: FX rates + currency conversion
- `market-matter-catalog`: Matter device type → cluster requirements lookup

## Get Started (Contributors)

Requirements:

- Node.js 20+
- pnpm 10+

Run locally:

```bash
pnpm install
pnpm dev
```

Contributor docs:

- Core dev guide: [core-dev/guide.md](./docs/core-dev/guide.md)
- CLI: [shared/cli.md](./docs/shared/cli.md)
- Troubleshooting: [shared/troubleshooting.md](./docs/shared/troubleshooting.md)

Quality gates:

```bash
pnpm lint
pnpm lint:modules
pnpm typecheck
pnpm test
pnpm build
```

Packaging:

```bash
pnpm package:mac
pnpm package:win
```

## Plugin Development (Marketplace)

This repo includes a marketplace workspace under `marketplace/`. A plugin is a self-contained web UI that runs in an isolated iframe and talks to the host via SDK.

- SDK contract: [sdk.md](./docs/plugin-dev/sdk.md)
- Plugin packaging & local registry: [packaging.md](./docs/plugin-dev/packaging.md)

Quick flow:

```bash
./cli.sh plugin create
pnpm --filter @devtoolbox/plugin-market-<id> build
node marketplace/scripts/pack-local.mjs market-<id>
```

Then in DevToolBox:

- Settings → Marketplace (Dev) → Registry URL → `file:///.../marketplace/registry.local.json`
- Modules → Refresh → Install

## Contributing

- Contributing guide: [contributing.md](./docs/governance/contributing.md)
- Roadmap: [roadmap.md](./docs/governance/roadmap.md)
- Built-in modules: [built-in-modules.md](./docs/core-dev/built-in-modules.md)
- Code of conduct: [code-of-conduct.md](./docs/governance/code-of-conduct.md)
- Security policy: [security.md](./docs/governance/security.md)
- Support: [support.md](./docs/governance/support.md)

## Repository Layout

```text
devtoolbox/
├── core/                              Electron app (main + preload + renderer)
├── marketplace/                       Marketplace plugins workspace (and local registry tooling)
├── docs/                              Documentation source (MkDocs)
├── docs-site/                         MkDocs site config (publish pipeline)
├── .github/                           CI / release workflows
├── cli.sh                             Repo CLI helpers
├── package.json
└── pnpm-workspace.yaml
```

## License

Apache-2.0
