# UI Guidelines

## Layout

- Tool pages should use `ToolSection` as the top-level container for consistent spacing and title/actions layout.
- Prefer `ResponsiveActions` when you have multiple actions; it will collapse overflow items into a menu on narrow layouts.

## Split Panes

Use `useSplitPane` to implement resizable split views, and style the divider consistently.

## Text Search Overlay

Use `useTextSearch` + `SearchBar` to implement Ctrl/Cmd+F search inside text areas or log panels.
