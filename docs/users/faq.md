# FAQ (Users)

## Marketplace

### The Marketplace tab is empty

DevToolBox loads plugins from a marketplace registry. If the registry returns an empty list, the Marketplace tab shows “Marketplace registry is empty”.

What to check:

- Click Refresh (Modules page)
- Verify your network can access the default registry URL:
  - https://github.com/XthingsJacobs/devToolBox/releases/download/marketplace/registry.json

### I cannot change the Registry URL

Custom registry URL override is only enabled in development builds. In packaged builds, DevToolBox always uses the default registry and requires HTTPS-only registry/download URLs for security.

### Install failed with “Only https is allowed”

In packaged builds:

- registry URLs must be `https://`
- plugin download URLs must be `https://`

`file://` is only supported in development builds for local plugin development.

## Updates

### “Check for Updates…” does nothing

Try:

- Ensure you are using a packaged build (the auto-updater is designed for installed apps)
- Check your network connectivity to GitHub Releases
- Try again from menu → Help → Check for Updates…

### How do I enable/disable background update checks?

Settings → Updates → Auto-check for updates

## Data & Cache

### What does “Clear Storage” do?

It clears caches and storage data used by DevToolBox and the marketplace (registries/zips cache). If a plugin behaves unexpectedly after an update, clearing storage is a safe first step.

### What does “Delete All Data” do?

It deletes all local app data and relaunches DevToolBox. You will lose:

- installed marketplace plugins
- plugin key-value storage
- app settings and caches

If you are not sure, use Clear Storage first.

## Support

### What should I include in a bug report?

See [Support](../governance/support.md). At minimum:

- app version / build number
- OS and architecture
- steps to reproduce
- screenshots/logs if relevant
