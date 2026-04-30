# Module API

Tool modules are defined by a `config.tsx` file and discovered automatically.

This document applies to built-in modules shipped with the app. Marketplace plugins use a separate SDK surface described in `docs/plugin-sdk.md`.

## ModuleConfig

See the `ModuleConfig` type in:

- `core/renderer/types`
- `core/packages/core` (shared types)

## Conventions

- `id` must be unique and stable, and must start with `core-`.
- `name` and `description` should be English.
- Prefer not to hardcode strings; use i18n when possible.
