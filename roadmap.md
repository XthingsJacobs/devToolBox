# DevToolBox Open Source Roadmap

This roadmap focuses on making DevToolBox easier to develop, extend, and contribute to, with special attention to Marketplace plugin authors.

Each item has an explicit completion state in the Status column:

- Completed: implemented in the repository.
- In Progress: actively being implemented.
- Planned: accepted direction, not started yet.
- Later: useful, but intentionally deferred.

## Phase 1: First Plugin Success

Goal: make a new contributor able to create, validate, build, and locally install a Marketplace plugin with a short feedback loop.

| Item | Status | Outcome |
| --- | --- | --- |
| Marketplace plugin templates include React, SDK usage, storage, notifications, and locale files | Completed | `plugin create` scaffolds a runnable React plugin with English and Chinese resources. |
| Add Marketplace plugin diagnostics | Completed | `plugin doctor <market-id|all>` validates manifest, package files, permissions, domains, i18n files, source entry points, package output, and local ZIP hints. |
| Add a 10-minute first-plugin guide | Completed | `docs/development/plugins.md` and `docs/zh-CN/development/plugins.md` document a task-oriented path from scaffold to local installation. |
| Add `plugin dev <market-id>` | Completed | `cli.sh` and `cli.ps1` start the plugin Vite server and print local packaging/install follow-up steps. |
| Improve manifest error messages | Completed | Marketplace lint errors now include `Fix:` guidance for manifest, permission, domain, and i18n failures. |

## Phase 2: Local Marketplace Preview

Goal: make local plugin iteration visible inside the app without requiring contributors to understand the registry internals first.

| Item | Status | Outcome |
| --- | --- | --- |
| One-command local registry preparation | Completed | `plugin init-local` resets `marketplace/registry.local.json`, clears `.local-dist`, and prints the local preview steps. |
| Local preview instructions in CLI output | Completed | After packing, both CLIs print the exact registry URL, Settings field, Marketplace refresh, and install steps. |
| Local Marketplace-only view/filter | Completed | Marketplace tab includes a `Local` filter for registry entries backed by local `file://` package URLs. |
| Plugin card metadata preview | Completed | Marketplace and installed plugin cards preview ID, permissions, domains, source, version, category, icon, and localized text. |

## Phase 3: Submission and Review

Goal: make external plugin submissions reviewable and predictable.

| Item | Status | Outcome |
| --- | --- | --- |
| Marketplace submission checklist | Completed | `docs/development/plugins.md` and `docs/zh-CN/development/plugins.md` document submission materials and reviewer checks. |
| Good first Marketplace issues | Completed | `docs/project/governance.md` and `docs/zh-CN/project/governance.md` list low-risk Marketplace contribution examples. |
| Plugin SDK changelog | Completed | `docs/development/plugin-sdk.md` and `docs/zh-CN/development/plugin-sdk.md` document SDK 1.0 capabilities and compatibility policy. |
| Plugin release verification guide | Completed | Marketplace plugin docs explain release verification commands, provenance bindings, and artifact immutability. |

## Phase 4: Runtime Developer Experience

Goal: make plugin runtime failures understandable inside DevToolBox.

| Item | Status | Outcome |
| --- | --- | --- |
| Plugin console and SDK call log panel | Completed | `PluginHost` now includes a collapsible runtime Console for iframe events, plugin logs, SDK calls, permission denials, and load errors. |
| Permission denial details | Completed | Capability broker `permission_denied` errors now include plugin ID, SDK method, required permission, manifest field, and suggested fix details. |
| Runtime reload tooling | Completed | Plugin docs describe the existing host **Reload plugin** flow for rebuilding failed or stale iframes during development. |
| Safer plugin examples for network and file workflows | Completed | Marketplace plugin docs include safe `sdk.http.request` and file-token workflow examples. |

## Current Implementation Notes

- Phase 1 is complete: new plugin authors now have scaffold, doctor, dev, package, local install, and actionable manifest feedback paths.
- Phase 2 is complete: local registry reset, preview instructions, local filtering, and metadata previews are implemented.
- Phase 3 is complete in documentation: submissions, good first Marketplace issues, SDK compatibility notes, and release verification now have contributor-facing guidance.
- Phase 4 is complete for the current roadmap: runtime console, permission denial details, reload guidance, and safer network/file examples are implemented or documented.
- Keep CLI behavior consistent between `cli.sh` and `cli.ps1`, and keep roadmap status current when an item lands.
