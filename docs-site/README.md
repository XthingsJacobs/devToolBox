# Docs Site (MkDocs Material)

This folder contains the MkDocs Material configuration for the DevToolBox documentation site.

- Content source: `../docs`
- MkDocs config: `mkdocs.yml`
- Build output: `site/`

## Languages

- English is the default language and lives directly under `../docs/` to preserve existing URLs.
- Translations use BCP 47 locale directories such as `../docs/zh-CN/` and mirror the English relative paths.
- Each language has a matching navigation group in `mkdocs.yml`; each page links directly to its translated counterpart.
- `../docs/zh-CN/README.md` translates the repository README for GitHub and is excluded from the documentation-site navigation.
- Add future languages by copying the page structure, translating content without changing code identifiers, and extending the navigation with one locale group.
- Run `pnpm lint:docs` from the repository root after changing documentation or navigation.

## Local Preview

```bash
cd docs-site
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mkdocs serve
```

## Cloudflare Pages

Recommended settings:

- Production branch: `main`
- Build command:
  - `pip install -r docs-site/requirements.txt && mkdocs build -f docs-site/mkdocs.yml`
- Build output directory:
  - `docs-site/site`
- Custom domain:
  - `dtb.256th.com`
