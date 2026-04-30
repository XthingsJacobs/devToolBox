# Repository Scripts

These scripts support development and contributor workflows for DevToolBox.

## Overview

- `lint-modules.mjs`: Validates the structure and metadata of tool modules.
- `new-tool.mjs`: Generates a new tool module scaffold under `core/renderer/components/ModuleTools/`.
- `exec-without-node-options.mjs`: Runs a command with `NODE_OPTIONS` cleared (helps avoid issues with injected node options).

## Usage

```bash
# Validate module structure (used by CI)
pnpm lint:modules

# Create a new tool module (interactive)
pnpm new:tool

# Create a new tool module (non-interactive examples)
pnpm new:tool TimestampConverter --category dev-tools
pnpm new:tool UrlCodec --id url-encode --with-help
```

## Notes for Contributors

- Scripts should remain dependency-free (plain Node.js) unless there is a strong reason to add dependencies.
- Do not add scripts that require private credentials or internal infrastructure.
