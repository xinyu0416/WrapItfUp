# WrapItfUp release notes / 版本紀錄

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

驗證：53 項公開自動測試；9／27 筆刪除、10 筆新增、孤立設定修復、接線預覽與參數介面的瀏覽器操作；真實 bash 接收器以 3 批、15 段還原 18 個通用檔案並核對 SHA-256。詳見 [r126 驗證](docs/VERIFICATION-r126.md)。

**限制：未取得這次實測的原始五 instance 專案及公司執行環境，因此未重跑該案例正常／Empty × ASIC／FPGA 的公司 gen_top、編譯或接線模擬。通用五 instance 測試不能代替此驗收。**

### English

- Atomic Top-pin deletion previews and removes dependent bindings, assignments and Empty ties, with one undo.
- Shared Empty validation exposes stale settings and supports direct removal/remapping.
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
