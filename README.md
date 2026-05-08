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

- SDK contract: [plugin-sdk.md](./docs/plugin-sdk.md)
- Plugin packaging & local registry: [marketplace.md](./docs/marketplace.md)

Quick flow:

```bash
./cli.sh plugin create
pnpm --filter @devtoolbox/plugin-market-<id> build
node marketplace/scripts/pack-local.mjs market-<id>
```

Then in DevToolBox:

- Settings → Marketplace Registry URL → `file:///.../marketplace/registry.local.json`
- Modules → Refresh → Install

## Contributing

- Contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Roadmap: [ROADMAP.md](./ROADMAP.md)
- Development guide: [dev-guide.md](./docs/dev-guide.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- Support: [SUPPORT.md](./SUPPORT.md)

## Repository Layout

```text
devtoolbox/
├── core/                              Electron app (main + preload + renderer)
├── docs/                              Developer documentation (MkDocs source)
├── docs-site/                         MkDocs site config
├── marketplace/                       Marketplace plugins workspace
├── scripts/                           Repo tooling (lint / scaffolding / release helpers)
├── package.json
└── pnpm-workspace.yaml
```

## License

Apache-2.0
