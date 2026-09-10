# Architecture Overview

DevToolBox is an Electron desktop app with a React renderer.

## Processes

- Main process: `core/main`
- Preload bridge: `core/main/preload`
- Renderer (React): `core/renderer`

## Module System

Tool modules are discovered via `import.meta.glob` and rendered inside a shared layout. Each module provides a `config.tsx` file describing its metadata and entry component.

## Workspace Packages

- `core/packages/core`: stable types and conventions shared across the repo
- `core/packages/ui`: shared UI components and hooks

## IPC

Renderer communicates with main via a typed preload API (`window.electronAPI`). Avoid exposing raw IPC channels directly to the renderer.

