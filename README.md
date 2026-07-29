# DevToolBox — Plugin-first, all-in-one Desktop Toolbox

[English](./README.md) | [简体中文](./docs/zh-CN/README.md)

[![CI](https://github.com/jacobs-256/devToolBox/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jacobs-256/devToolBox/actions/workflows/ci.yml)
[![CodeQL](https://github.com/jacobs-256/devToolBox/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/jacobs-256/devToolBox/actions/workflows/codeql.yml)
![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)

DevToolBox is a cross-platform desktop toolbox built with Electron + React + TypeScript + Vite.

It aims to be a plugin-first, all-in-one workspace for everyday developer utilities:

- Built-in tool modules: formatter, codec, crypto, network, MQTT, JWT, diff, etc.
- Marketplace plugins: install, update, and build your own tools as plugins
- One app, one search, one workspace: keep common utilities together instead of scattered scripts

## Featured Tools

Built-in tool modules worth trying first:

- Markdown Preview
- QR Code Generator
- MQTT Tool

Marketplace plugins in this repo (examples):

- `market-ip-lookup`: IP geolocation lookup with multi-provider fallback
- `market-exchange-rate`: FX rates + currency conversion
- `market-matter-catalog`: Matter device type → cluster requirements lookup

## Start Here

| Goal                             | Guide                                                           |
| -------------------------------- | --------------------------------------------------------------- |
| Download and use DevToolBox      | [Getting Started](./docs/getting-started.md)                    |
| Contribute to the repository     | [Contributing Guide](./CONTRIBUTING.md)                         |
| Understand the application       | [Architecture](./docs/development/architecture.md)              |
| Add a built-in tool              | [Built-in Tool Development](./docs/development/tools.md)        |
| Build a Marketplace plugin       | [Marketplace Plugin Development](./docs/development/plugins.md) |
| Follow the interface conventions | [Design System](./docs/development/design-system.md)            |

Download packaged releases from [GitHub Releases](https://github.com/jacobs-256/devToolBox/releases). In the application, install plugins from **Modules → Marketplace → Refresh → Install**.

## Project

- [Documentation](./docs/index.md)
- [Roadmap](./docs/project/governance.md#roadmap)
- [Changelog](./docs/project/changelog.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)
- [Support](./SUPPORT.md)

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
