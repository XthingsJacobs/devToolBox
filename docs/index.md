# DevToolBox Documentation

[English](index.md) | [简体中文](zh-CN/index.md)

DevToolBox is a cross-platform desktop toolbox built with Electron, React, TypeScript, and Vite. It combines built-in developer utilities with an isolated Marketplace plugin runtime.

## Choose a path

| I want to...                  | Start here                                        |
| ----------------------------- | ------------------------------------------------- |
| Install or run DevToolBox     | [Getting Started](getting-started.md)             |
| Understand the repository     | [Architecture](development/architecture.md)       |
| Add a built-in tool           | [Built-in Tool Development](development/tools.md) |
| Build a Marketplace plugin    | [Plugin Development](development/plugins.md)      |
| Use Plugin SDK APIs           | [Plugin SDK Reference](development/plugin-sdk.md) |
| Follow UI conventions         | [Design System](development/design-system.md)     |
| Contribute or report an issue | [Project and Community](project/governance.md)    |

## How the application is organized

- The Electron **main process** owns operating-system access, storage, networking, and IPC handlers.
- The **preload bridge** exposes a typed, restricted API to the renderer.
- The React **renderer** discovers built-in tools from their manifests and renders the desktop UI.
- Marketplace plugins run in sandboxed iframes and request capabilities through the Plugin SDK.

Built-in tools and Marketplace plugins are intentionally separate extension models. Use a built-in tool when the feature ships with the application and can use the typed preload API. Use a Marketplace plugin when it should be packaged, installed, and permissioned independently.

## Documentation map

### Use the application

- [Getting Started](getting-started.md): downloads, source setup, CLI commands, packaging, and troubleshooting.

### Develop the application

- [Architecture](development/architecture.md): process boundaries, repository layout, module discovery, IPC, and security boundaries.
- [Built-in Tool Development](development/tools.md): scaffolding, manifests, localization, UI patterns, IPC, and validation.
- [Plugin Development](development/plugins.md): plugin lifecycle, permissions, local registry, and packaging.
- [Plugin SDK Reference](development/plugin-sdk.md): SDK namespaces, method signatures, parameters, return values, limits, and errors.
- [Design System](development/design-system.md): current design tokens, component conventions, page patterns, and design-artifact guidance.

### Project information

- [Project and Community](project/governance.md): contributing, community policies, releases, and documentation ownership.
- [Changelog](project/changelog.md): documentation-level release notes.
- [Notice](project/notice.md): copyright and third-party software notice.

## Sources of truth

Documentation explains the current implementation, but executable contracts remain authoritative:

- Built-in tool metadata: each tool's `manifest.json`
- Marketplace manifest types: `core/packages/core/src/index.ts`
- Plugin client SDK: `core/packages/plugin-sdk/src/index.ts`
- Renderer-to-main API: `core/main/preload/index.ts` and `core/renderer/types/electron.d.ts`
- Repository commands: `package.json`, `cli.sh`, and `cli.ps1`
