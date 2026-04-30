# DevToolBox

DevToolBox is a cross-platform desktop toolbox built with Electron and React.

## What you can do

- Run built-in developer utilities (formatters, converters, network tools, etc.)
- Install and run marketplace plugins in an isolated runtime (iframe + SDK)

## Key concepts

- The app is split into Electron main/preload/renderer processes.
- Built-in tools are auto-discovered and rendered inside a shared layout.
- Marketplace plugins communicate with the host only through the Plugin SDK.

## Quick links

- [Installation](installation.md)
- [CLI](cli.md)
- [Plugin SDK](plugin-sdk.md)
- [Troubleshooting](troubleshooting.md)

