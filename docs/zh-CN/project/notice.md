# 声明

[English](../../project/notice.md) | [简体中文](notice.md)

DevToolBox

Copyright 2026 Jacobs

本产品包含第三方开发的软件。每个打包发布版本都会提供：

- `THIRD_PARTY_NOTICES.md`：根据已安装的生产依赖树生成；
- `sbom.cdx.json`：CycloneDX 格式的软件物料清单；
- `SHA256SUMS`：覆盖应用产物和发布元数据的校验和列表。

从源码构建时，请在安装依赖后运行 `pnpm supply-chain:generate`。生成的文件会写入 `dist/supply-chain/`。

DevToolBox 自身以 [Apache License 2.0](https://github.com/jacobs-256/devToolBox/blob/main/LICENSE) 发布。
