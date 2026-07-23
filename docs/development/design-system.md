# Design System

[English](design-system.md) | [简体中文](../zh-CN/development/design-system.md)

This guide combines runtime UI conventions, the Figma specification, and the local Figma generator. The application styles are the source of truth; Figma is a design and review aid rather than a separate implementation contract.

## Principles

- **Theme-aware:** every shared surface and tool must work in both dark and light themes.
- **Consistent:** controls with the same purpose use the same spacing, shape, state, and language.
- **Compact but readable:** DevToolBox is information-dense, but density must not hide hierarchy or reduce target sizes.
- **Capability-focused:** each tool presents its primary input, action, and result without unrelated application chrome.
- **Accessible:** keyboard focus, contrast, error states, and narrow-window behavior are first-class states.

## Sources of truth

| Concern                                        | Source                                                |
| ---------------------------------------------- | ----------------------------------------------------- |
| Runtime color, type, radius, and layout tokens | `core/renderer/theme/variables.css`                   |
| Shared utility styles                          | `core/renderer/theme/toolkit.css`                     |
| Shared React components and hooks              | `core/packages/ui/`                                   |
| Tool-level reusable layout patterns            | Existing components under `core/renderer/components/` |
| Figma seed tokens and pages                    | `figma/plugins/devtoolbox-ui-kit-generator/code.ts`   |

When a Figma value differs from the runtime variables, update the design artifact or generator; do not add a local CSS override just to match an outdated mockup.

## Runtime tokens

### Color

Use semantic variables instead of literal colors:

| Role                    | Variables                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces                | `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-elevated`, `--bg-hover`                                                         |
| Borders                 | `--border-default`, `--border-subtle`, `--border-emphasis`, `--border-focus`                                                             |
| Text                    | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-quaternary`, `--text-disabled`, `--text-on-accent`                      |
| Accent and status       | `--accent-primary`, `--accent-secondary`, `--accent-success`, `--accent-error`, `--accent-warning`                                       |
| Selected and info state | `--state-selected-bg`, `--state-selected-border`, `--state-selected-text`, `--state-info-bg`, `--state-info-border`, `--state-info-text` |
| Code syntax             | `--syntax-key`, `--syntax-string`, `--syntax-number`, `--syntax-boolean`, `--syntax-null`                                                |
| Categories              | `--cat-dev`, `--cat-text`, `--cat-network`, `--cat-security`, `--cat-other`                                                              |

Dark theme values live in `:root`; light theme overrides live in `:root[data-theme='light']`. Prefer semantic intent over a palette name. For example, use `--text-tertiary` for supporting text rather than copying its current hex value.

Use selected-state variables for selectable rows, navigation, and option cards. Reserve `--accent-primary` with `--text-on-accent` for solid primary actions. Information banners use the `--state-info-*` group; do not embed a dark surface color in a component. Shared floating elements use the theme-aware shadow variables instead of literal black shadows.

### Typography

- UI family: `--font-family` (Inter with platform fallbacks)
- Monospace family: `--font-family-mono` (JetBrains Mono/Fira Code and platform fallbacks)
- Base size: `--font-size-base`
- Supporting sizes: `--font-size-small`, `--font-size-xs`
- Headings: `--font-size-heading`, `--font-size-title`
- Body line height: `--line-height-base`

Use the monospace family for code, logs, serialized data, hashes, and machine-oriented output. Do not use it for ordinary controls or explanatory text.

### Shape and layout

The runtime variables define shared radii, floating shadows, sidebar width, module-panel width, and maximum workspace width. Use these variables rather than duplicating dimensions in a module.

Build local spacing on a 4 px rhythm. Common gaps and padding are 4, 8, 12, 16, 20, and 24 px. Use the smallest value that preserves grouping and readable click targets.

## Component conventions

### Buttons and actions

- Use a default button for ordinary actions and a visually distinct primary button for the main task.
- Keep icon-only buttons square and provide an accessible label or tooltip.
- Show hover, active, focus-visible, and disabled states.
- Separate destructive actions and require confirmation when data cannot be recovered.
- Use `ResponsiveActions` when a row can overflow at narrow widths.

### Inputs, text areas, and selects

- Keep labels visible when the meaning is not obvious from context.
- Use placeholders as examples, not as the only label.
- Preserve a strong focus-visible state and a clear invalid/error state.
- Put clear, copy, reveal, and search actions in consistent suffix positions.
- Use `useTextSearch` with `SearchBar` for Ctrl/Cmd+F inside editor-like surfaces.

### Cards and rows

Cards group related content; they should not wrap every individual field. A list row normally places title and supporting text on the left and status or actions on the right. Use badges for concise state or version information, not long messages.

### Dialogs

Dialogs need a clear title, focused content, and a predictable action area. The primary action goes last in reading order. Confirmation dialogs state exactly what changes and whether it is reversible.

### Split panes

Use `useSplitPane` for resizable two-column tools. Keep the divider discoverable, preserve a usable minimum width on both sides, and provide an expand/restore action when one side benefits from temporary focus.

## Application layout

The desktop shell has three conceptual regions:

1. Navigation selects the dashboard or tool category.
2. The module panel selects a tool within the active category.
3. The content workspace renders the active page or tool.

Tool pages should use `ToolSection` as their top-level container. A useful tool page usually has:

- A header with title, short context, and optional actions
- A scrollable body containing the primary interaction
- An optional footer for persistent input or execution controls

Do not reproduce application navigation inside a tool. Keep long explanations in help content and reserve the workspace for the task.

## State design

Design and test each relevant state:

- Initial or empty
- Loading or running
- Success with copy/export actions
- Validation error near the responsible input
- Runtime or network failure with recovery guidance
- Disabled or unavailable capability
- Long content and narrow window
- Light and dark themes

Logs and protocol streams should distinguish system, sent, received, warning, and error events with both text and color. Never rely on color alone.

## Figma library structure

The intended Figma file uses these pages:

```text
0 Cover
1 Tokens
2 Components
3 Templates
4 Archive
```

Organize the component page by increasing composition:

- **Atoms:** buttons, inputs, checkboxes, switches, badges, and icons
- **Molecules:** search fields, labeled controls, tab groups, and list rows
- **Organisms:** navigation, module panels, dialogs, tool headers, and split workspaces

Recommended templates include Dashboard, Tools, Modules/Marketplace, Settings, Global Search, and representative tool pages. Use a 1440 x 900 desktop frame for the main reference and add narrow-window variants for responsive behavior.

The generator creates the page structure plus color and text styles. Component variants and production-ready templates still require design work; generated frames are a starting point, not proof that a component is implemented.

## Use the Figma generator

Build it from the repository root:

```bash
node figma/plugins/devtoolbox-ui-kit-generator/build.mjs
```

The build writes `figma/plugins/devtoolbox-ui-kit-generator/dist/code.js`.

Import the development plugin in Figma:

1. Open **Plugins -> Development -> Import plugin from manifest...**.
2. Select `figma/plugins/devtoolbox-ui-kit-generator/manifest.json`.
3. Open the target Figma file.
4. Run **Plugins -> Development -> DevToolBox UI Kit Generator**.
5. Choose **Generate/Update UI Kit**.

The operation creates or updates the five pages and seeds `Color/...` and `Text/...` styles. Re-running it updates matching named styles without replacing hand-built component content.

## UI review checklist

- Runtime variables are used instead of a private palette.
- Both themes preserve hierarchy, contrast, and visible focus.
- Primary, destructive, disabled, loading, empty, and error states are clear.
- Keyboard actions and text search behave consistently.
- Tool layout works at narrow window widths without hiding essential actions.
- Figma specifications that changed are synchronized with runtime tokens.
