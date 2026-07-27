# @devtoolbox/plugin-sdk

Browser SDK for DevToolBox Marketplace plugins.

```ts
import { sdk } from '@devtoolbox/plugin-sdk';
```

React plugins can mount their application with the host theme and optional locale bridge:

```tsx
import { mountPlugin, usePluginLocale } from '@devtoolbox/plugin-sdk/react';

function App() {
  const locale = usePluginLocale();
  return <div>{locale}</div>;
}

mountPlugin(<App />, { locale: true });
```

## Build the npm package

The workspace resolves `src/` directly for fast plugin development. The release build creates a self-contained npm package under `dist/`:

```bash
pnpm --filter @devtoolbox/plugin-sdk typecheck
pnpm --filter @devtoolbox/plugin-sdk build
pnpm --filter @devtoolbox/plugin-sdk pack:check
```

The generated package contains ESM, declarations, source maps with their TypeScript sources, README, LICENSE, and a release-only `package.json`. It has no dependency on private DevToolBox workspace packages. Publish the generated directory, never this private source package:

```bash
npm pack ./core/packages/plugin-sdk/dist
npm publish ./core/packages/plugin-sdk/dist --access public
```

Use the **Plugin SDK Release** GitHub workflow to build an auditable tarball. Its `publish` input defaults to `false`; enabling it publishes with npm provenance after the package checks pass.

The npm package patch version can change independently, while the public host protocol follows the manifest's major/minor `sdkVersion`. `src/contract-check.ts` keeps the SDK method and response contracts aligned with `@devtoolbox/core` during repository type checking.
