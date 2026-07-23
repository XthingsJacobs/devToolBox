# Getting Started

[English](getting-started.md) | [简体中文](zh-CN/getting-started.md)

This guide covers installing DevToolBox, running it from source, using the repository CLI, packaging installers, and resolving common local-development problems.

## Install a release

Download a packaged release from the [GitHub Releases page](https://github.com/XthingsJacobs/devToolBox/releases). Install Marketplace plugins from **Modules -> Marketplace -> Refresh -> Install**.

The remaining sections are for contributors and plugin authors working from the repository.

## Run from source

### Requirements

- Node.js 20 or newer (`.nvmrc` pins the default contributor version)
- pnpm 10 or newer (the repository pins `pnpm@10.10.0` as the default)
- Git

Install dependencies and start the desktop development server:

```bash
pnpm install
pnpm dev
```

The equivalent CLI workflow is:

```bash
./cli.sh doctor
./cli.sh dev
```

On Windows PowerShell, use the Windows entry point:

```powershell
.\cli.ps1 doctor
.\cli.ps1 dev
```

If `cli.sh` is not executable on macOS/Linux, run `chmod +x ./cli.sh` once.

## Repository CLI

`cli.sh` and `cli.ps1` are the unified entry points for common development and packaging workflows. Use `cli.sh` on macOS/Linux and `cli.ps1` on Windows PowerShell. Run `./cli.sh help` or `.\cli.ps1 help` for the current command list.

| Command                            | Purpose                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `./cli.sh doctor`                  | Print the detected Node.js, pnpm, and Git versions.                          |
| `./cli.sh dev`                     | Start the Electron development environment.                                  |
| `./cli.sh build`                   | Type-check and build the renderer, main process, and preload bridge.         |
| `./cli.sh check`                   | Run lint, type-check, and tests.                                             |
| `./cli.sh tool new`                | Start the interactive built-in tool generator.                               |
| `./cli.sh plugin create`           | Create a Marketplace plugin template.                                        |
| `./cli.sh plugin <market-id>`      | Build and pack one plugin into the local registry.                           |
| `./cli.sh plugin all`              | Build and pack every local Marketplace plugin.                               |
| `./cli.sh package <target> [arch]` | Build a macOS or Windows installer.                                          |
| `./cli.sh clear`                   | Interactively clear selected user data, caches, plugins, or build artifacts. |

On Windows, replace `./cli.sh` with `.\cli.ps1`; Windows packaging supports `.\cli.ps1 package windows [x64]`.

`./cli.sh clear` and `.\cli.ps1 clear` delete local data only after interactive confirmation. Close DevToolBox before using them and read each prompt carefully.

## Build and validate

Build the application without creating an installer:

```bash
pnpm build
```

Run the standard quality gates:

```bash
pnpm lint
pnpm lint:docs
pnpm typecheck
pnpm test
pnpm build
pnpm test:electron
```

`test:electron` loads the production preload in a hidden Electron window, so run it after `pnpm build`.

`pnpm lint` validates built-in and Marketplace manifests, architecture boundaries, and documentation consistency. Contributors can run focused checks separately with `pnpm lint:modules`, `pnpm lint:boundaries`, or `pnpm lint:docs`.

## Package installers

Common examples:

```bash
./cli.sh package macos arm64
./cli.sh package macos x64
./cli.sh package macos universal
./cli.sh package windows
./cli.sh package all
```

Windows PowerShell:

```powershell
.\cli.ps1 package windows
.\cli.ps1 package windows x64
```

Run `./cli.sh package` without arguments for the interactive flow.

- macOS packages are written to `release/` as `.dmg` files.
- Windows packages are written to `release/` as `.exe` files.
- Packaging must generally run on the target operating system. Building Windows packages on macOS may require Wine and Mono; CI or a Windows machine is more reliable.

## Backup protection

Backup files contain application settings, Marketplace state, and plugin key-value data. Choose protection according to how the file will be used:

- No protection creates a compressed but unencrypted backup.
- Device protection encrypts the backup for the current DevToolBox installation and is not portable.
- Password protection creates a portable encrypted backup; use at least eight characters and store the password separately.
- Enabling both requires the same device and the password during restore.

Current versions still import older backups that contain the legacy built-in compatibility layer, but new backups no longer treat an application-embedded key as a confidentiality boundary.

## Troubleshooting

### Export a diagnostic bundle

Open **Settings → Diagnostics** to review recent local runtime events. Use **Export bundle** when sharing a problem report with maintainers. The JSON bundle is created only after you choose a destination and contains redacted events, application/runtime versions, and the current startup/safe-mode state; its generated context does not include usernames, hostnames, IP addresses, environment variables, or local-storage contents. Credential-like and content/body/payload fields are removed from events before they are stored.

Use **Clear log** to remove the locally retained events. DevToolBox does not upload diagnostics automatically.

### DevToolBox starts in safe mode

After two consecutive launches fail before the Renderer becomes healthy, the next launch temporarily pauses every Marketplace plugin. Built-in tools and the Module Center remain available, and no plugin is permanently disabled.

Review **Settings → Diagnostics**, export a bundle if needed, and uninstall or disable the suspected plugin from **Modules**. Select **Restart normally** when ready. You can also choose **Restart in safe mode** from the diagnostics page before reproducing a plugin-related startup problem.

### Dependency installation is slow or fails

Verify access to the npm registry, then prune the pnpm store and retry:

```bash
pnpm store prune
pnpm install
```

### CI passes but local checks fail

Check the versions first:

```bash
./cli.sh doctor
```

On Windows PowerShell:

```powershell
.\cli.ps1 doctor
```

Use Node.js 20 or newer, pnpm 10 or newer, and a current lockfile installation. Re-run `pnpm install` if dependencies are incomplete.

### Windows opens without native window controls

Development windows on Windows and Linux open maximized, not in exclusive fullscreen, so the native minimize, maximize, and close buttons remain visible. If those controls are missing, make sure you are running a build that includes the current main-process window behavior and restart DevToolBox.

### Recording export reports a missing `ffmpeg`

The `KvsWebrtcViewer` recording export requires a system `ffmpeg` binary. On macOS:

```bash
brew install ffmpeg
```

Install the equivalent system package on Linux or Windows and ensure the executable is available on `PATH`.

### Ping or traceroute behaves differently across systems

Windows and macOS/Linux use different command names and flags. The main process handles the known platform differences, but restricted shells, containers, and managed devices may still block raw network diagnostics or require additional permissions.

### A local Marketplace plugin is not visible

Rebuild the local registry, then verify that Settings points to the generated `file://` registry URL:

```bash
./cli.sh plugin <market-id>
```

On Windows PowerShell:

```powershell
.\cli.ps1 plugin <market-id>
```

Refresh the Marketplace after changing the registry URL. See [Plugin Development](development/plugins.md) for the complete local installation flow.

## Next steps

- Read [Architecture](development/architecture.md) before changing process or IPC boundaries.
- Follow [Built-in Tool Development](development/tools.md) for an application-shipped tool.
- Follow [Plugin Development](development/plugins.md) for an independently packaged extension.
