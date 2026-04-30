# IPC API

This document describes the preload API surface exposed to the renderer.

## Principles

- Only expose whitelisted APIs via `contextBridge`.
- Avoid passing arbitrary file paths or executing arbitrary commands.
- Keep the renderer typed via `core/renderer/types/electron.d.ts`.

## Location

- Main handlers: `core/main/ipc/*`
- Preload bridge: `core/main/preload/index.ts`
- Renderer types: `core/renderer/types/electron.d.ts`

## Plugin SDK IPC

Marketplace plugins do not call IPC directly. The renderer hosts each plugin in an iframe and translates plugin `postMessage` requests into preload IPC calls.

Key channels used by the plugin runtime:

- `plugin:httpRequest`
- `plugin:storageGet` / `plugin:storageSet` / `plugin:storageDelete` / `plugin:storageList` / `plugin:storageClear`
- `plugin:fsOpenFileDialog` / `plugin:fsSaveFileDialog` / `plugin:fsReadFile` / `plugin:fsWriteFile`
- `plugin:systemOpenExternal` / `plugin:systemRevealPath` / `plugin:systemOpenPath` / `plugin:systemNotify` / `plugin:systemGetInfo` / `plugin:systemGetEnv`
- `plugin:log` (forward `sdk.log.*` to main process output when debug is enabled)

## Built-in MQTT Tool IPC

The built-in MQTT Tools module uses main-process MQTT connections and forwards events back to the renderer.

- `mqtt:connect` / `mqtt:disconnect` / `mqtt:subscribe` / `mqtt:unsubscribe` / `mqtt:publish`
- `mqtt:event` (main → renderer event stream)
