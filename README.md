# WrapItfUp

**Public r125 · Module interfaces → Top wiring → RTL and diagram handoff**

[Open WrapItfUp](https://xinyu0416.github.io/WrapItfUp/) · [繁體中文](#繁體中文) · [English](#english) · [Release notes](RELEASE_NOTES.md) · [Verification](docs/VERIFICATION-r125.md)

WrapItfUp 把子模組介面、Top 實例接線、RTL 與圖面放在同一份設計中。先定義或匯入模組，放入實例，完成接線，再帶走可繼續編輯的專案與交付檔案。

This repository contains the maintainable application source, public examples, regression tests, build tools, documentation, and GitHub Pages workflow. It is not just a compiled HTML snapshot.

## 繁體中文

### 從這裡開始

1. 開啟 [網站](https://xinyu0416.github.io/WrapItfUp/)。第一次使用可選「開啟完整範本」，查看已接好的兩個通用子模組。
2. 建立設計或匯入 RTL。模組列表管理**模組定義**；Top 接線頁管理**實例與連線**。
3. 在名稱欄直接修改可編輯名稱。匯入 RTL 的來源限制會顯示原因，不能假裝改名成功。
4. 修改訊號、位寬、方向、群組和參數，再到 Top 接線頁完成連接並查看檢查結果。
5. 儲存 `.wiu.json` 專案；由交付功能下載 RTL、VBS 或完整交付包。

### 主要能力

| 工作 | 支援內容 |
| --- | --- |
| 模組介面 | 訊號表、群組、參數化位寬、方向、RTL 匯入及介面圖 |
| Top 組裝 | 同一模組的多個實例、接線、常數、明確空接、Top I/O、參數覆寫 |
| 編輯 | 拖移、搜尋／取代、內嵌改名、展開／收合、Undo／Redo |
| 刪除模組 | 同時處理受影響的實例、接線與圖面資料；整筆操作可復原 |
| 檢查 | 名稱與連線問題、未完成接線、來源及生成限制提示 |
| 交付 | Top Verilog、Empty/stub、org、output.cfg、外部工具執行輔助檔及 Visio VBS |
| 保存 | 完整專案下載、重新開啟、瀏覽器本機草稿 |

### 名稱與檔案用途

產品與 repository 統一為 **WrapItfUp**；離線成品為 **WrapItfUp-r125-offline.html**。工程目錄沿用 WaveASecond 的 `src/`、`tests/`、`tools/`、`examples/`、`docs/` 命名習慣。`package.json` 的 npm 識別名稱 `wrapitfup` 使用小寫，並非產品顯示名稱。RTL 中的模組／訊號名稱保留使用者輸入的大小寫。

| 檔案 | 用途 |
| --- | --- |
| `.wiu.json` | 可繼續編輯的完整設計與工作區狀態；這是主要保存格式 |
| `.v` | 匯入的 RTL 或產生的 Verilog；單獨一份 Top RTL 不能取代完整專案 |
| `.v.org`、`.output.cfg` | 外部 gen_top 流程的輸入與輸出組態 |
| `.empty.v` | Empty/stub；與正常接線版本分開核對 |
| `.vbs` | 在支援的 Windows／Visio 環境產生圖面 |
| 交付 ZIP | 設計產物、組態、執行輔助檔和該設計的 README |

瀏覽器草稿方便恢復工作，不能取代下載備份。更換裝置、瀏覽器或清除網站資料前，先儲存專案。

### 常用快捷鍵

| 動作 | Windows／Linux | macOS |
| --- | --- | --- |
| 復原 | Ctrl+Z | Command+Z |
| 重做 | Ctrl+Shift+Z 或 Ctrl+Y | Command+Shift+Z |
| 儲存專案 | Ctrl+S | Command+S |
| 搜尋／取代 | Ctrl+F／Ctrl+H | Command+F／Command+H |
| 下一個／上一個搜尋結果 | F3／Shift+F3 | F3／Shift+F3 |
| 圖面展示／重新適應畫面 | F5 | F5，依鍵盤設定可能需 Fn |

輸入欄位內的文字編輯與整份專案的歷史有不同作用範圍；先完成或取消當前文字編輯，再進行設計復原。

### 公開版邊界

本 repo 不附公司手冊、原始工具程式、公司案例、內部驗證紀錄或專用 stencil。內建範例是可公開的通用 source／sink 設計。

gen_top／gen_empty 等外部執行工具需由使用者在自己的環境提供。網站能產生相容輸入與輔助檔，但**產生檔案不等於已執行外部工具、RTL 模擬或完成等價驗證**。原有 org 指令語法保留，避免因公開版清理破壞相容性。VBS 亦需在 Windows／Visio 中另行驗證。

設計在瀏覽器處理；應用沒有設計上傳服務或追蹤程式。網站託管商仍會收到一般頁面請求。

## English

### Start here

Open [WrapItfUp](https://xinyu0416.github.io/WrapItfUp/) and choose the complete example to inspect a connected two-module design. Create or import module definitions, place instances in Top, connect ports, review diagnostics, and save the project before exporting deliverables.

The module list owns definitions; the Top view owns instances and wiring. Editable names use inline fields. Deleting a definition can remove its dependent instances and connections as one undoable operation. Source-owned definitions retain their import restrictions.

### Capabilities and formats

- Define interfaces with signals, groups, directions, widths, and parameters; import supported RTL.
- Assemble instances with Top I/O, parameters, net expressions, constants, and deliberate unconnected ports.
- Edit diagrams and tables, search and replace, undo and redo, and save or reopen complete workbooks.
- Export Verilog, Empty/stub, org/output.cfg, external-tool handoff files, and Visio VBS.
- Use `.wiu.json` as the editable project format. An exported Top `.v` alone is not a project backup.

Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes, Ctrl+Y also redoes on Windows/Linux. Ctrl/Cmd+S saves; Ctrl/Cmd+F/H searches/replaces; F3 and Shift+F3 navigate results. F5 opens or fits the drawing presentation. Text fields have their own editing scope.

### Public edition and verification limits

The public edition excludes internal manuals, original external-tool code, internal teaching projects, private verification records, and proprietary stencils. The bundled example is generic. Design processing runs in the browser, with no application design-upload endpoint or analytics; normal hosting requests still reach the hosting provider.

External gen_top/gen_empty tools are separate user-provided dependencies. Existing org directive syntax remains intact. Exporting compatible files does not establish external-tool execution, successful RTL simulation, or functional equivalence. Visio automation requires a supported Windows/Visio environment. See the [verification report](docs/VERIFICATION-r125.md) for what this release actually checks.

## Repository / 專案結構

| Path | Responsibility / 職責 |
| --- | --- |
| `index.html` | Editable source shell; loads local files in their original order / 可編輯入口 |
| `src/` | Application logic, data model, UI and CSS / 真正的原始碼 |
| `tests/` | Public fixtures, behavior tests and pre-extraction output baseline / 公開測試與基準 |
| `tools/` | Dependency-free build, local server and artifact audit / 建置與檢查 |
| `examples/` | Loadable generic project and corresponding RTL / 可載入範例 |
| `docs/` | Architecture, public-edition boundary and verification / 架構與驗證文件 |
| `.github/workflows/pages.yml` | Test → build → audit → deploy / 通過檢查才部署 |
| `dist/` | Generated Pages output; ignored by Git / 生成目錄 |
| `preview/` | Generated standalone HTML; ignored by Git / 離線成品目錄 |
| `RELEASE_NOTES.md` | Version changes and verification limits / 版本紀錄 |

The organization follows WaveASecond's source/test/tool/example/documentation separation. WrapItfUp remains plain JavaScript and CSS; no framework migration or new runtime dependency is required. Existing version suffixes in source filenames identify retained behavior layers, not a different product version. See [architecture](docs/ARCHITECTURE.md).

### Develop and build / 開發與建置

Use Node.js 22.12 or later. The project has **zero third-party package dependencies**.

```sh
npm ci
npm run dev
npm test
npm run build
npm run audit:dist
npm run build:offline
```

`npm run dev` serves the source at `http://127.0.0.1:4173`. `npm run preview` serves `dist/` after building. For all release checks:

```sh
npm run release:check
```

`npm run build` embeds the source into `dist/index.html`. `npm run build:offline` creates `preview/WrapItfUp-r125-offline.html` from exactly the same builder. The offline HTML contains all application scripts and styles and opens without a development server or CDN. Download the full repository with GitHub **Code → Download ZIP**; build the offline file locally, or download the `WrapItfUp-r125-offline` artifact from a successful Actions run while it remains available.

### GitHub Pages

Set **Settings → Pages → Source → GitHub Actions**. Pushes to `main` run tests, build both outputs, audit the public artifact, and deploy `dist/` only after success. Pull requests run the same build checks but do not deploy. Do not hand-edit generated `dist/` files.

### Reporting a problem / 回報問題

Include the version, browser, exact steps, expected result, actual result, and a small **public-safe** sample. Do not attach company RTL, credentials, private paths, internal manuals, or confidential design screenshots to public issues.
