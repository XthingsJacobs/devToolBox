# Troubleshooting

## Requirements

- Node.js: 20
- pnpm: 10

## `pnpm install` is slow or fails

- Verify your network can reach the npm registry.
- Try pruning the pnpm store and reinstalling:

```bash
pnpm store prune
pnpm install
```

## CI passes but local `pnpm lint` fails

- Ensure your local Node version matches `.nvmrc`.
- Ensure dependencies are installed:

```bash
pnpm install
```

## Packaging/recording fails because `ffmpeg` is missing

The `KvsWebrtcViewer` recording export depends on a system `ffmpeg` binary.

On macOS:

```bash
brew install ffmpeg
```

## `ping` / `traceroute` behavior differs per OS

Windows and macOS/Linux use different flags. The main process implements platform-specific handling, but some environments may still require additional permissions.
