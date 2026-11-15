# WrapItfUp release notes / 版本紀錄

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
