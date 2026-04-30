# Marketplace Packaging (Local Development)

DevToolBox marketplace plugins are built and packaged from the monorepo under:

`marketplace/`

## Naming Conventions

- Marketplace plugin `manifest.id` must start with `market-`.

## Create a Plugin Template

```bash
./cli.sh plugin create
```

## Local Build

Example (your plugin):

```bash
pnpm --filter @devtoolbox/plugin-<market-id> build
```

The build output is written to the plugin `package/` directory defined by its manifest entry.

## Local Install via Registry

DevToolBox installs marketplace plugins via a `registry.json`. For local development, you can generate a local zip and a `file://` registry:

```bash
node marketplace/scripts/pack-local.mjs <market-id>
```

This produces:

- `marketplace/registry.local.json`
- `marketplace/.local-dist/<plugin>-<version>.zip`

Then in DevToolBox:

- Settings → Marketplace Registry URL → paste the `file:///.../registry.local.json` URL
- Modules → Refresh → Install

## Notes

- In development, `file://` registry and download URLs are allowed.
- In packaged builds, only `https://` registry and download URLs are allowed.

## Shortcut

Build + pack into local registry (interactive):

```bash
./cli.sh plugin <market-id>
```
