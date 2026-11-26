# WrapItfUp r140 — 霧玫瑰 Clock 與編輯區分離

- 採用 A 霧玫瑰: 細圓圈與方波 #A65F86, 淡底 #F8EAF1. 未啟用為灰色虛線圓, 焦點框收在點選區內.
- Clock, 方向箭頭與名稱分開配置, 左右鏡射且不限制接腳方向. 名稱編輯不再蓋住拖曳/刪除工具或相鄰訊號.
- 縮小畫面時點名稱會先放大至可讀比例. 可用「返回原視野」還原鏡頭, 不改專案間距或接線.
- 介面圖, Top 圖, SVG 與 VBS 使用共用 Clock 幾何與配色. Top 單色模式保留.
- 修正重新載入後僅物件欄位順序不同就誤擋連續復原的問題. 真正資料衝突仍會阻擋.
- [本版驗證與限制](docs/VERIFICATION-r140.md).

The selected dusty-rose Clock glyph is shared across live controls and diagram exports. Reserved hit targets and camera-based text focus keep editing local and readable. Clock type metadata, electrical inputs and generator behavior are preserved.

# WrapItfUp r139 — Clock 開關狀態辨識

Clock 未啟用時顯示灰色空心虛線圓, 啟用時顯示黑底白色方波. Hover 與焦點只標示操作外框, 避免編輯文字時看起來像已啟用 Clock. 既有顯示時機與切換行為不變.

Inactive Clock controls use a dashed outline; active controls use a black disc and a white square wave. Hover and focus do not alter the state symbol. [Verification](docs/VERIFICATION-r139.md).

# WrapItfUp r138 — 圖上名稱編輯與 Clock 標記

- 修正縮小圖面後, 右側訊號名稱的編輯框偏移與文字裁切. 左右名稱都固定接腳側邊緣, 放大的編輯框向 block 內延伸.
- 接腳旁的圓圈方波可直接切換 Clock. 取消時恢復原本類型, 包括 1-bit Data; 不改接線方向或位寬.
- 圖上操作和訊號表共用類型更新邏輯, 支援復原, 重做與專案保存.
- [本版驗證與範圍](docs/VERIFICATION-r138.md).

Right-side inline editing keeps its port-side anchor and exposes the readable input at reduced zoom. Direct Clock controls preserve the previous non-clock type, electrical data and generator output.

# WrapItfUp r137 — 訊號複製貼上

- 整個訊號使用系統剪貼簿在 WrapItfUp 與 WaveASecond 間複製貼上，每次貼上都新增。
- 波形類型、已知位寬及群組透過共用格式傳遞。目的網站沿用自己的預設與歷史操作。
- 1-bit Data 保留使用者選擇，跨站貼到 WaveASecond 使用全圖時間軸。
- 兩站共 494 項回歸測試及建置/發佈檢查通過. Chrome 已實測雙向複製貼上, 整批復原與文字/波形格分流. 41 份 RTL/org/設定產物與 r136 相同. 未重跑公司 Linux 或 Windows Visio. [完整驗證紀錄](docs/CLIPBOARD-VERIFICATION.md).

- 子模組圖與 Top 圖統一只顯示 pin 名，線段標示多位元寬度，Clock 接腳顯示圓圈方波。

# WrapItfUp release notes / 版本紀錄

## Public r136

Top 接線圖可直接編輯整條 net 名稱及各分支的圖面標籤. 選線時在畫布下方顯示 Driver 和 Load 的完整路徑. 擁擠設計可以預覽分配走線空間後的結果, 確認再套用. 接線表保留同一端點的多段切片, 同一設計的位寬解析與工作包檢查結果共用.

Linux verification attempts retain separate records for each implementation and device. An older run can be verified again without changing which generation is latest. Transfer receipts identify their package. [Verification](docs/VERIFICATION-r136.md)

## Public r135 — 2026-11-25

工作包 org 恢復分節、群組及註解。Top I/O 依原宣告次序連續列出，接線可就近核對。修正純量與等效單位元子模組接腳的回讀誤報，以及不同交付頁面顯示的參數、Empty 和 org 預覽資訊。

Individual and packaged exports use the same org layout. Section and group comments survive import and export, and active conditional sources retain their existing validation. [Verification](docs/VERIFICATION-r135.md)

## Public r134 — 2026-11-18

Top 接線圖點選單一 net 後直接並列兩端完整路徑，名稱可換行，支援多 Load 選擇與定位。一般草稿／組態狀態收於專案選單，草稿失敗或有未套用輸入時仍會直接提示。背景整理完成時釋出整列空間，幾何檢查仍可從畫布底部開啟。

The child sheet now previews, copies and downloads the same physical RTL source used by the package, including file-level directives and module bodies. Declaration-only editing and copying remain available. [Verification](docs/VERIFICATION-r134.md).

## Public r133 — 2026-11-18

新增獨立的 Group 接線圖。勾選要展示的 instance／group 後，可將目前畫面匯出成 SVG 或 PNG。群組之間的多條 net 合成一條線，保留 fanout、正反向與不同 instance 的識別。

The Top toolbar now includes a presentation view with per-instance group selection, merged edges, distinct-net counts and directional arrows. Both ends must have a group. The export uses the displayed subset. See [verification and scope](docs/VERIFICATION-r133.md).

## Public r132 — 2026-11-17

Top 外側為不同訊號保留獨立線道並擴大空間；修正把框外文字區算成可走線範圍，以及大型重新走線過久的問題。加入依完整接線資料定位的 Driver／Load、多 Load 輪巡、返回原視野；接線表改成兩端 Instance / Group / Pin 對照。

Separate Top boundary lanes and physical frame bounds replace shared escape columns. Driver/Load navigation uses the full electrical endpoint index, including offscreen loads. The connection table displays both endpoint paths while retaining inline and batch editing.

89 automated tests, release build and public-content audit passed. Full manual UI and large-project output parity remain pending; this is the same r132 application delivered for early review. Interior routing conflicts are not cleared or hidden. [Verification status](docs/VERIFICATION-r132.md) · [r130 → r132 update](docs/UPDATE-r130-r132.md).

## Public r131 — 2026-11-17

### 繁體中文

檢查頁直接列出 instance、訊號／接腳、目前設定與原因，不再需要逐項進入編輯器才辨認問題。沿用同一份驗證結果，未接線與刻意不接 NC 仍明確區分。

修正手動修復排除了空間擴張的條件，以及把所有已保存位置當成鎖定的問題。「修復線距與擴大空間」先比較原圖、擴張及重排結果，預覽圖面尺寸與衝突數；保護鎖定方塊及水平長條，只接受各類衝突都不增加的結果。套用可一次復原／重做，沒有改善時保持原圖。原精細局部修復保留為較慢的獨立入口。

實際七 instance 設計在約 5.8 秒內完成比較，線距不足 8,858 → 6,797，共線 7,493 → 5,957，安全衝突維持 0；既有 46 項未接線及 RTL 預覽保持一致。剩餘擁擠仍多，不能視為排線全部通過。大型圖初次開啟維持快速路徑，尚未完全達成歷史要求的初次自動精排。

83 項測試、離線建置與公開內容稽核通過。相關舊需求、實際瀏覽器驗證及未測環境見 [r131 驗證紀錄](docs/VERIFICATION-r131.md)。

### English

Validation now presents instance, pin, current binding and reason directly. Explicit repair restores space expansion previously excluded by the force flag and distinguishes saved positions from real layout locks. It compares expanded/rerouted candidates, accepts no increase in any diagnostic category, protects rigid control bars and locks, previews dimensions/counts, and commits one undoable operation. Slow local repair remains available separately. A supplied dense design improved spacing conflicts from 8,858 to 6,797 in 5.8 seconds with identical electrical data and RTL preview; unresolved congestion remains. All 83 tests and release builds pass. See the verification report for retained features, the incomplete automatic-first-pass goal, and external tools not run.

## Public r130 — 2026-11-17

### 繁體中文

依實際大型專案修正 r129 仍會背景逾時與一次建立全部 SVG／操作區的問題。

- 超過 200 筆 binding 的互動圖面採有限候選避障路徑與有上限的備援搜尋。停止在每次開圖時自動進行高成本的全圖線距／轉角修復，保留完整檢查及按需精細修復。
- 超過 400 個端點的畫布只建立視窗附近元素，保留跨越視窗的線；低於 35% 縮放顯示總覽。放大、平移和搜尋會恢復接腳與線名編輯。
- 完整 scene、接線模型及匯出不裁切。修正畫面外搜尋定位，保留未提交的線名草稿，編輯中避免視窗重建。
- 立即匯出 VBS 也使用背景完成的受檢圖面，補齊 Worker 保存專案所需的 Empty 設定正規化依賴。
- 78 項測試、完整 build／audit／offline build；實際專案保存前後電氣資料與 RTL 預覽逐字相同。原有 46 項未設定接腳錯誤保持不變，未宣稱可通過工作包匯出或公司工具驗證。

實測與限制見 [r130 驗證紀錄](docs/VERIFICATION-r130.md)。精細排線品質仍有改善空間；此版沒有把圖面衝突隱藏或算作通過。

### English

Dense interactive diagrams now use bounded candidate routing, keep full final checks and defer expensive global repair until requested. Viewport culling and zoom-dependent overview controls reduce DOM/painting work without trimming the model or exports. Offscreen search, inline drafts, pan/zoom restoration and immediate background VBS export are covered. A supplied design's routing completed in 2.3–2.9 seconds instead of timing out at 30 seconds in r129. Its electrical model and RTL preview remained identical after browser save; existing unconfigured pins still block normal export. See the report for scope, measurements and untested external tools.

## Public r129 — 2026-11-17

### 繁體中文

修正 Top 接線圖將避障、線距修復、交叉分析全部同步跑在操作執行緒，以及新增尚未使用的子模組仍讓全圖快取失效的問題。

- 先顯示可編輯的快速圖面；完整幾何計算交給本機背景 Worker。進度顯示目前階段，可暫停或重試。切頁取消計算，連續修改淘汰舊結果。
- 圖面快取只依 Top 用到的介面與圖面資料更新；新增未使用子模組直接進入介面編輯，不先重畫隱藏 Top。
- 路徑搜尋使用穩定優先佇列；大型圖面先限制自動修復的工作量，但仍檢查全部線路、保留所有衝突提醒。額外修復由「排列與走線」明確啟動。
- 自動背景工作 30 秒、明確的排列／VBS 工作 120 秒上限。逾時保留可操作的預覽並顯示未完成，不回到前景硬算。
- 背景結果是衍生圖面資料，不直接寫入 Undo 文件；保存／匯出把圖面快照附到副本，避免背景完成後阻斷復原。
- VBS 在背景完成正式圖面後下載；快速預覽不會冒充圖面檢查通過。RTL／工作包仍使用原有接線與產生器。
- 原有 r128 及更早的 frozen route 快照持續可讀。

實測及限制見 [r129 驗證紀錄](docs/VERIFICATION-r129.md)。這次沒有執行公司 gen_top、ASIC／FPGA 編譯、模擬或 Windows Visio。

### English

Top geometry now runs in a cancellable local worker while an interactive preview remains available. Cache keys exclude unused module definitions and source/delivery-only changes. New module sheets open without reconstructing the hidden Top. Stable heap routing replaces repeated frontier sorting. Dense graphs receive bounded automatic repair with full final geometry checks and all unresolved warnings retained; additional repair is explicit. Automatic jobs stop after 30 seconds; explicit layout/export jobs after 120 seconds.

Derived scenes stay outside the undoable document. Saving/exporting attaches a checked snapshot to a copy. Stale jobs cannot overwrite later edits. Quick scenes are never certified/exported as final VBS. Existing electrical data, generators, offline delivery and legacy snapshots remain supported. See the verification report for measured results and untested external environments.

## Public r128 — 2026-11-17

### 繁體中文

此版由可核對的 r126 原始碼重建。先前 r127 的可下載成品與完整原始碼未能取回，因此不宣稱還原原 r127。

- 圖面名稱、位寬與註解使用同一個原位編輯流程；確認後才更新設計。避免前一欄失焦重畫吞掉下一次點擊，保留錯誤草稿與游標。
- 修正欄位攔住後續 Ctrl+Z 的情況；文字歷史與專案歷史依目前狀態交接。Enter／Tab 及 Shift 反向換列／換欄。
- 工具列提供可持續使用的「多選」與清除選取；名稱最末端數字自動遞增，保留補零並跳過衝突。
- Top wire 點擊文字即可編輯；只改名稱會保留位寬，同步更新綁定、assign 與 Empty 引用。錯誤輸入在重畫後仍可修正。
- 每個 instance 可切換一般方塊／底部水平長條，寬度依其他 blocks 展開。按連接對象分區，水平訊號名稱，上／下緣 pin 可調整，分區可收合；保存與復原包含版型資料。個別 wires 仍保持獨立，不將不同訊號合併成一條 bus。
- 補齊四向 pin 的走線逃離方向與下緣安全空間；保留既有一般方塊。
- 附不含公司資料的 ControlBar 五實例範例。

驗證與限制見 [r128 驗證紀錄](docs/VERIFICATION-r128.md)。公司案例的 gen_top 執行、ASIC／FPGA 正常／Empty 編譯與模擬，以及 Windows Visio 實際執行，均未在此環境重跑。

### English

Rebuilt from verified r126 source; the prior r127 artifact/source could not be recovered. This release does not claim to restore the missing build.

Unified in-place canvas editing, stable focus/caret, invalid-draft recovery, repeated undo/redo handoff, persistent multi-select, final-digit name incrementing, and direct wire renaming with range/reference preservation. Per-instance bottom horizontal bars group pins by connected instance, retain horizontal labels, support top/bottom pin placement and independent disclosure, and persist/undo presentation metadata separately from electrical data. Four-sided routing includes a bottom escape corridor. A generic controller/four-channel example is included.

See the verification report for regression and browser evidence. Company gen_top execution, ASIC/FPGA normal/Empty compile/simulation and actual Windows Visio execution were not rerun here.

## Public r126 — 2026-11-15

### 繁體中文

- Top 接腳刪除先預覽受影響接線、assign 與 Empty 設定；整批確認與一次復原。遇到未解析來源則阻擋部分修改。
- Empty 畫面與工作包使用同一個 Empty 驗證器。舊的孤立／重複設定保留顯示，可直接移除或重新指定。
- 訊號表整批修改先呈現處理狀態、統一套用；編輯介面時不再重跑隱藏的 Top 走線捕捉，對話框避免重複送出。
- 批次接線接受 Tab 或明確的空白分隔，提供可複製範例與可直接修正的逐列來源／目的預覽。
- 接線建議檢查方向、有效位寬、signed 與 instance／通道名稱；多候選需選擇。Top output 提升收在進階區，所有選取均先預覽。
- Linux 文字傳送一次顯示目前步驟，從切換 bash 開始，明示 Enter 與接收器回報；複製、接收、SHA-256、產生及編譯／模擬分開。
- 工作包文件改用當前版本；歷史相容性檢查與本次外部執行結果分開。參數標示區分預設／覆寫，並增加不同 instance 值的保存及匯出回歸。
- 啟動完成前顯示載入狀態，避免舊介面先閃現。

驗證：54 項公開自動測試；9／27 筆刪除、10 筆新增、孤立設定修復、接線預覽與參數介面的瀏覽器操作；真實 bash 接收器以 3 批、15 段還原 18 個通用檔案並核對 SHA-256。詳見 [r126 驗證](docs/VERIFICATION-r126.md)。

**限制：未取得這次實測的原始五 instance 專案及公司執行環境，因此未重跑該案例正常／Empty × ASIC／FPGA 的公司 gen_top、編譯或接線模擬。通用五 instance 測試不能代替此驗收。**

### English

- Atomic Top-pin deletion previews and removes dependent bindings, assignments and Empty ties, with one undo.
- Shared ASIC/FPGA Empty validation exposes stale settings and supports direct removal/remapping.
- Batched interface edits avoid hidden Top routing; dialogs show work-in-progress and reject duplicate submissions.
- Editable paste previews accept Tabs or unambiguous whitespace. Conservative wiring suggestions review direction, width, signedness and channel identity; Top exposure is explicit.
- Stepwise Linux transfer starts with bash and separates clipboard, receipt, hashes, generation and compile/simulation states.
- Current-version delivery documents, explicit parameter default/override labels, persistence/export coverage, and a startup readiness barrier.

Public checks and browser QA are documented separately from external tool execution. The exact reported five-instance design and company environment were unavailable; its ASIC/FPGA normal/Empty matrix has **not** been rerun in this release.

## Public r125 — 2026-11-15

### 繁體中文

- 將公開版從單一上線 HTML 整理為 `src/`、`tests/`、`tools/`、`examples/`、`docs/` 與 GitHub Actions 的完整專案，參照 WaveASecond 的目錄責任分工。
- 產品與 repository 命名統一 **WrapItfUp**；補齊中英 README、資料模型說明、公開版邊界與驗證紀錄。
- 同一份原始碼可建置 GitHub Pages 與真正單檔離線 HTML，無第三方套件、CDN 或開發伺服器依賴。
- 保留既有功能、專案格式、生成核心和樣式順序；利用公開範例逐檔比對生成輸出與完整 HTML 還原雜湊。
- 37 項公開回歸測試。外部 gen_top 與 Windows Visio 執行仍需在相應環境另行驗證。

### English

- Reorganized the public app into maintainable source, tests, tools, examples, documentation and a gated Pages workflow, following WaveASecond's repository organization.
- Standardized product/repository naming as **WrapItfUp**, with bilingual usage/build documentation and explicit data-model and public-edition boundaries.
- Added one dependency-free builder for Pages and a genuinely self-contained offline HTML.
- Preserved runtime behavior, saved-project formats, generation code and style ordering. Compared generic delivery output and reconstructed HTML against the prior public release.
- Added 37 public regression tests. External generator and Windows Visio execution remain separate environment-specific verification steps.

## Public r124.1

Initial sanitized public distribution, generic source/sink example, and compact example placement. Private manuals, original external-tool sources, internal teaching material and proprietary stencil payloads were excluded. Published as a self-contained HTML snapshot; r125 adds the missing maintainable repository structure.
