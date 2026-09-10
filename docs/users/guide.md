# User Guide

This guide is for people who download DevToolBox to use built-in tools and marketplace plugins.

## Supported Platforms

DevToolBox ships installers for:

- macOS (DMG / ZIP)
- Windows (NSIS installer, x64)

## Download and Install

1. Download the latest installer from GitHub Releases:
   - https://github.com/XthingsJacobs/devToolBox/releases
2. Install:
   - macOS: open the DMG and drag DevToolBox into Applications (or use the ZIP)
   - Windows: run the installer (it allows selecting the installation directory)

## Updates

DevToolBox uses an auto-updater (GitHub release provider).

- Manual check: menu → Help → Check for Updates…
- Auto-check: Settings → Updates → Auto-check for updates
  - When enabled, DevToolBox checks on startup and periodically in the background

If a new version is found, you can:

- Update Now: download and install immediately
- Later: remind later
- Skip This Version: ignore a specific version

## Marketplace Plugins (Install / Upgrade / Disable)

Marketplace plugins run in an isolated iframe runtime and use a host-provided SDK. You can install and manage them from the Modules page.

### Install a Plugin

1. Open Modules
2. Switch to the Marketplace tab
3. Click Refresh
4. Click Install on the plugin card

### Upgrade a Plugin

- If updates are available, Modules → Installed shows an “Update All” banner
- You can also upgrade a single plugin from its card

### Disable / Enable a Plugin

Modules → Installed:

- Toggle Enabled / Disabled on the plugin card

### Uninstall a Plugin

Modules → Installed:

- Click the trash icon on the plugin card

### Marketplace Registry

DevToolBox uses an official registry by default:

- https://github.com/XthingsJacobs/devToolBox/releases/download/marketplace/registry.json

In development builds only, DevToolBox also supports overriding the registry URL:

- Settings → Marketplace (Dev) → Registry URL

If the Registry URL is empty, DevToolBox uses the default registry.

## Data & Cache

Settings → Data & Cache provides tools to clean caches and storage:

- Clear Storage: clears cache and storage data used by DevToolBox and marketplace registries/zips
- Danger Zone:
  - Reset All Settings: resets app settings (theme/locale/update settings)
  - Delete All Data: deletes all local app data and relaunches DevToolBox

## How to Report Issues

Use GitHub Issues for bug reports and feature requests:

- Include: app version/build number, OS/architecture, steps to reproduce, and screenshots/logs if relevant
- For security reports, do not file public issues — follow [Security Policy](../governance/security.md)

See [Support](../governance/support.md) for details.

## FAQ

- [FAQ (Users)](faq.md)
