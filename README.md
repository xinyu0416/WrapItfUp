# WrapItfUp

**Public r132 · Module interfaces → Top wiring → RTL and diagram handoff**

[Open WrapItfUp](https://xinyu0416.github.io/WrapItfUp/) · [繁體中文](#繁體中文) · [English](#english) · [Release notes](RELEASE_NOTES.md) · [Verification](docs/VERIFICATION-r132.md)

WrapItfUp 把子模組介面、Top 實例接線、RTL 與圖面放在同一份設計中。先定義或匯入模組，放入實例，完成接線，再帶走可繼續編輯的專案與交付檔案。

This repository contains the maintainable application source, public examples, regression tests, build tools, documentation, and GitHub Pages workflow. It is not just a compiled HTML snapshot.

## 繁體中文

### 從這裡開始

1. 開啟 [網站](https://xinyu0416.github.io/WrapItfUp/)。第一次使用可選「開啟完整範本」，查看已接好的兩個通用子模組。
2. 建立設計或匯入 RTL。模組列表管理**模組定義**；Top 接線頁管理**實例與連線**。
3. 在名稱欄直接修改可編輯名稱。匯入 RTL 的來源限制會顯示原因，不能假裝改名成功。
4. 修改訊號、位寬、方向、群組和參數，再到 Top 接線頁完成連接並查看檢查結果。
5. 儲存 `.wiu.json` 專案；由「產生 RTL／gen_top」下載 RTL、VBS 或 Linux 工作包。
6. 文字傳送時依序執行 `bash`、接收器、資料批次、`CHECK`，每次貼上後按 Enter。貼回終端回報核對檔案數與 SHA-256，再於 Linux 執行產生與驗證。網站檢查不代表 Linux 已執行。

### r132 外側線距與接線檢閱

Top 最外側改用獨立線道，必要時擴大空間；舊圖可用「排列與走線 → 重新自動走線」預覽後套用。選取線段可使用 Driver／Load 定位、輪巡 Load 與返回原視野。接線表顯示來源 Instance / Group / Pin、方向、位寬、目的 Instance / Group / Pin、狀態與操作。

89 項自動測試及離線建置通過，完整人工介面與大型專案輸出比對尚未完成；圖內仍有線距／重疊提醒。見 [本版驗證狀態](docs/VERIFICATION-r132.md)。從 r130 更新請見 [更新方式](docs/UPDATE-r130-r132.md)。

### r131 檢查明細與線距修復

「檢查」直接列出每筆 instance、訊號／接腳、目前設定與原因；需要修改時才按「前往修正」。在 Top「排列與走線 → 修復線距與擴大空間」比較重排前後的圖面尺寸與衝突，再決定是否套用。套用可一次 Undo／Redo。手動線與鎖定方塊保留，沒有改善時不變更設計；較慢的「精細局部修復」另列並可取消。

實際大型設計的線距不足由 8,858 降至 6,797，但仍有大量擁擠，不能當作全部通過。首次開啟大型圖仍採下述快速路徑；完整驗證與舊需求盤點見 [r131 紀錄](docs/VERIFICATION-r131.md)。

### r130 大型接線圖

大型圖面先顯示快速預覽，在本機背景完成有上限的避障搜尋及全圖檢查；精細線距／轉角修復由「排列與走線」按需啟動。畫面只建立視窗附近的接腳、文字與操作區；縮到 35% 以下顯示總覽，放大還原編輯細節。搜尋仍可定位畫面外訊號。這些顯示取捨不刪除設計資料或匯出內容。

實際大型設計的背景計算由 r129 的 30 秒逾時改善為約 2.3–2.9 秒；數字是同一測試環境的量測，不是所有電腦的保證。新增未使用子模組沿用 Top 圖面快取。剩餘走線衝突照常列出，不視為通過。完整數據、資料比對與限制見驗證紀錄。

### r128 的編輯與底部控制模組

- 點圖上的訊號名稱、位寬、註解直接編輯。Enter 到下一列，Tab 到下一欄，Shift 反向，Esc 取消。縮小圖面後，作用中的輸入框仍保留可讀字級。
- 工具列「多選」開啟後逐項點選，縮放與平移保留選取；按「清除選取」取消。要輸入文字時關閉多選。
- 建立副本依名稱最末端數字遞增，例如 `data_p1 → data_p2`、`lane009 → lane010`，跳過已有名稱。
- Top 圖點 wire 文字改名，未輸入位寬時保留原位寬；Ctrl 點選用於追蹤。
- 在 Top 點選 instance 標題，選「水平長條」，會將該 instance 放到底部並延伸至其他 blocks 的寬度。依連接對象分區，名稱水平顯示；可逐區收合。點 pin 名稱可選「移到上緣／下緣」。這些設定只屬於該 instance，存入專案且支援復原。
- 可開啟 [ControlBar 通用範例](examples/ControlBar.wiu.json) 試用一個控制模組連接四個通道模組。

### 主要能力

| 工作 | 支援內容 |
| --- | --- |
| 模組介面 | 訊號表、群組、參數化位寬、方向、RTL 匯入及介面圖 |
| Top 組裝 | 同一模組的多個實例、接線、常數、明確空接、Top I/O、參數覆寫 |
| 編輯 | 拖移、搜尋／取代、內嵌改名、展開／收合、Undo／Redo |
| 刪除 Top 接腳 | 列出受影響接線、assign、Empty 設定，確認後整批清理；一次復原 |
| 接線建議 | 核對方向、位寬、instance／通道；多候選明確選擇，預覽來源 → 目的 |
| 刪除模組 | 同時處理受影響的實例、接線與圖面資料；整筆操作可復原 |
| 檢查 | 名稱與連線問題、未完成接線、來源及生成限制提示 |
| 交付 | Top Verilog、Empty/stub、org、output.cfg、外部工具執行輔助檔及 Visio VBS |
| 保存 | 完整專案下載、重新開啟、瀏覽器本機草稿 |

舊專案如有失去接腳的 Empty 設定，可在「設定暫代輸出 → 只看錯誤」直接移除或重新指定。參數摘要會區分 module 預設與此 instance 的覆寫值。

### 名稱與檔案用途

產品與 repository 統一為 **WrapItfUp**；離線成品為 **WrapItfUp-r132-offline.html**。工程目錄沿用 WaveASecond 的 `src/`、`tests/`、`tools/`、`examples/`、`docs/` 命名習慣。`package.json` 的 npm 識別名稱 `wrapitfup` 使用小寫，並非產品顯示名稱。RTL 中的模組／訊號名稱保留使用者輸入的大小寫。

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

輸入欄位內優先復原尚未套用的文字；欄位已乾淨且沒有文字歷史時，Ctrl+Z／重做快捷鍵會繼續操作目前模組／專案歷史。尚未修正的錯誤草稿會阻擋儲存並定位欄位。

### 公開版邊界

本 repo 不附公司手冊、原始工具程式、公司案例、內部驗證紀錄或專用 stencil。內建範例是可公開的通用 source／sink 設計。

gen_top／gen_empty 等外部執行工具需由使用者在自己的環境提供。網站能產生相容輸入與輔助檔，但**產生檔案不等於已執行外部工具、RTL 模擬或完成等價驗證**。原有 org 指令語法保留，避免因公開版清理破壞相容性。VBS 亦需在 Windows／Visio 中另行驗證。

設計在瀏覽器處理；應用沒有設計上傳服務或追蹤程式。網站託管商仍會收到一般頁面請求。

## English

### Start here

Open [WrapItfUp](https://xinyu0416.github.io/WrapItfUp/) and choose the complete example to inspect a connected two-module design. Create or import module definitions, place instances in Top, connect ports, review diagnostics, and save the project before exporting deliverables.

The module list owns definitions; the Top view owns instances and wiring. Editable names use inline fields. Deleting a definition can remove its dependent instances and connections as one undoable operation. Source-owned definitions retain their import restrictions.

For Linux text transfer, follow the separate `bash`, receiver, data batches and `CHECK` steps, pressing Enter after each paste. Clipboard success is separate from receiver confirmation, file hashes, generation, compilation and simulation. Orphan Empty settings can be removed or reassigned in the UI. Top-pin deletion previews related connections, assignments and Empty settings and commits one undoable transaction.

### r132 outer lanes and connection review

Top boundary routing reserves separate lanes and expands available space. Use the explicit reroute preview to upgrade an older saved drawing. Selecting a wire exposes Driver/Load navigation, Load cycling and return-to-view. The review table shows both Instance / Group / Pin paths, direction, width, status and actions. All 89 automated tests and release builds passed; full manual UI and large-project output comparisons remain pending. Interior geometry conflicts remain visible. See [verification status](docs/VERIFICATION-r132.md) and [r130 update instructions](docs/UPDATE-r130-r132.md).

### r131 issue details and spacing repair

The check page directly lists instance, pin, current binding and reason. Use Top's layout menu → **修復線距與擴大空間** to preview expanded/rerouted geometry, dimensions and diagnostics before applying one undoable transaction. Manual routes and locked blocks are preserved; no improvement leaves the project unchanged. Slow local repair remains a separate cancellable action. Dense first opening still uses bounded routing. Real-design spacing conflicts decreased from 8,858 to 6,797, but significant congestion remains; see the [verification and prior-requirement review](docs/VERIFICATION-r131.md).

### r130 large wiring diagrams

Dense diagrams use bounded local background routing and full final checks. Expensive spacing/corner repair is an explicit operation under the layout menu. The screen renders nearby geometry and hit targets; below 35% zoom, overview mode omits unreadable pin/name controls and restores them when zoomed in. Offscreen search uses full-scene coordinates. Project data and exports remain complete.

A supplied large design improved from r129's 30-second background timeout to 2.3–2.9 seconds in the measured environment. These are measurements, not hardware-independent guarantees. Unused module creation reuses Top geometry. Unresolved drawing conflicts remain visible; completion is not a geometry or RTL pass.

### r128 editing and horizontal control blocks

Click names, widths, comments or wire labels to edit in place. Enter moves down, Tab moves across, Shift reverses, and Escape cancels. Clean fields allow repeated project undo/redo after local text history is exhausted. Persistent multi-select survives pan/zoom. Duplicate names increment their final digit run, including `_p1` and padded numbers. Wire-only renames preserve the previous range.

Select an instance header in Top, then choose the horizontal-bar layout. Pins are grouped by connected instance, with horizontal labels and independent disclosure controls. Select a pin label to place it on the upper or lower edge. Width, pin sides, position and disclosure state are saved as presentation metadata, with undo; electrical definitions and exports stay unchanged. The generic [ControlBar example](examples/ControlBar.wiu.json) contains one controller and four channel instances.

### Capabilities and formats

- Define interfaces with signals, groups, directions, widths, and parameters; import supported RTL.
- Assemble instances with Top I/O, parameters, net expressions, constants, and deliberate unconnected ports.
- Edit diagrams and tables, search and replace, undo and redo, and save or reopen complete workbooks.
- Export Verilog, Empty/stub, org/output.cfg, external-tool handoff files, and Visio VBS.
- Use `.wiu.json` as the editable project format. An exported Top `.v` alone is not a project backup.

Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes, Ctrl+Y also redoes on Windows/Linux. Ctrl/Cmd+S saves; Ctrl/Cmd+F/H searches/replaces; F3 and Shift+F3 navigate results. F5 opens or fits the drawing presentation. Text fields have their own editing scope.

### Public edition and verification limits

The public edition excludes internal manuals, original external-tool code, internal teaching projects, private verification records, and proprietary stencils. The bundled example is generic. Design processing runs in the browser, with no application design-upload endpoint or analytics; normal hosting requests still reach the hosting provider.

External gen_top/gen_empty tools are separate user-provided dependencies. Existing org directive syntax remains intact. Exporting compatible files does not establish external-tool execution, successful RTL simulation, or functional equivalence. Visio automation requires a supported Windows/Visio environment. See the [verification report](docs/VERIFICATION-r131.md) for what this release actually checks.

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

`npm run build` embeds the source into `dist/index.html`. `npm run build:offline` creates `preview/WrapItfUp-r132-offline.html` from exactly the same builder. The offline HTML contains all application scripts and styles and opens without a development server or CDN. Download the full repository with GitHub **Code → Download ZIP**; build the offline file locally, or download the `WrapItfUp-r132-offline` artifact from a successful Actions run while it remains available.

### GitHub Pages

Set **Settings → Pages → Source → GitHub Actions**. Pushes to `main` run tests, build both outputs, audit the public artifact, and deploy `dist/` only after success. Pull requests run the same build checks but do not deploy. Do not hand-edit generated `dist/` files.

### Reporting a problem / 回報問題

Include the version, browser, exact steps, expected result, actual result, and a small **public-safe** sample. Do not attach company RTL, credentials, private paths, internal manuals, or confidential design screenshots to public issues.
