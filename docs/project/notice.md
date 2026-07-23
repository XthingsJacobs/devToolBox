# Notice

[English](notice.md) | [简体中文](../zh-CN/project/notice.md)

DevToolBox

Copyright 2026 Jacobs

This product includes software developed by third parties. Every packaged release publishes:

- `THIRD_PARTY_NOTICES.md`, generated from the installed production dependency tree;
- `sbom.cdx.json`, a CycloneDX software bill of materials;
- `SHA256SUMS`, covering the application artifacts and release metadata.

For source builds, run `pnpm supply-chain:generate` after installing dependencies. The generated files are written to `dist/supply-chain/`.

DevToolBox itself is distributed under the [Apache License 2.0](https://github.com/XthingsJacobs/devToolBox/blob/main/LICENSE).
