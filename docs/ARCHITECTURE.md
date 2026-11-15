# WrapItfUp architecture / 架構

## Repository boundary

`index.html` is the source shell. Its classic scripts and styles retain their reviewed order. `tools/build.mjs` substitutes these local references without bundling transformations, minification, or dependency resolution. Both Pages and offline HTML are produced by the same function. All 76 extracted runtime source/style files retain the r124.1 content except `release.js` metadata.

The directory convention follows WaveASecond. A React/Vite conversion is unnecessary for this structural release. No private baseline directory is needed to build or test this repository.

## Data ownership / 資料責任

| Layer | Fields / files | Contract |
| --- | --- | --- |
| Design | `schema`, `top`, `modules`, `instances`, `nets`, `connections`, `assigns` | Electrical and naming intent; the source for exports |
| Module definition | Stable `id`, `name`, `ports`, `parameters` | One definition can be referenced by multiple instances |
| Instance | Stable `id`, `name`, `module`, parameter overrides | Ports bind through instance IDs, not drawing coordinates |
| Connection | `instance`, `port`, `expr` | Missing binding differs from deliberate empty string; expressions may be constants or nets |
| Imported source | `rtlSources`, import metadata | Preserve original source bytes and edit restrictions |
| Diagram state | `workbook.diagrams`, `graphPositions`, `wireRoutes` | Visual geometry must not redefine electrical connectivity |
| Session workspace | Envelope `workspace` | Active page, selection and disclosure state |
| Persistence | `format: "WrapItfUp"` envelope, version, integrity metadata | `workbook.envelope()` writes; `workbook.read()` validates and migrates supported formats |
| History | `history.js`, `history-flow-r118.js` | Transaction patches with scope; dependent changes cannot be silently partially undone |

「定義」與「實例」分開。刪除定義時，先計算受影響的實例、端口綁定、來源及圖面，再以單筆交易更新；Undo 必須恢復整筆資料。畫面收合狀態以穩定 ID 保存，不應因搜尋或重新渲染自動反轉。

## Runtime responsibilities

| Files | Purpose |
| --- | --- |
| `assembly-core.js`, `assembly-parser.js` | Model validation, RTL/org parsing and generation |
| `workbook.js`, `assembly-actions.js` | Normalize, save/load, module/instance editing and cascade deletion |
| `assembly-defines.js`, `assembly-bundle.js`, `assembly-company.js` | Mode resolution and external-tool delivery |
| `delivery-assets.js`, `delivery-transfer.js` | Authored handoff helpers and integrity-aware transfer |
| `assembly-toolchain-assets.js` | Empty compatibility shim; never a place to bundle private tools |
| `editor.js`, `assembly-ui.js` | Retained interface editor and assembly UI orchestration |
| `signal-table-model-r120.js`, `interaction-r124.js` | Table planning, names and persistent disclosures |
| `graph-*.js`, routing/geometry modules | Layout, connection geometry and rendering |
| `native-visio-*.js` and related modules | Native Visio drawing export |
| `shortcut-routing.js`, history and workspace modules | Command routing, history and workspace behavior |
| `*.css` | Ordered style layers; original style IDs remain in the shell |

## Version and schema policy

- Product/repository/artifact prefix: **WrapItfUp**. npm identifier: `wrapitfup`.
- Product version is in `src/release.js` and `package.json`; it is separate from saved-project schema versions.
- Existing runtime filenames with older revision suffixes remain stable to avoid breaking relative imports and behavior ordering.
- Do not bump project schema solely because source files moved.
- Do not change org syntax tokens to cosmetically remove a vendor word; source syntax is an interoperability contract, not a bundled document.

## Release contract

Tests cover public behavior and generic exported-file bytes. The HTML reconstruction test verifies the complete build against the preceding public artifact after normalizing only release metadata. This baseline protects the structural migration; an intentional future feature change must update the affected expected behavior and explain why in release notes.

Any future split of the large retained editor or CSS layers should be a separate, verified change. This release makes source reviewable without claiming the legacy implementation is fully modularized.
