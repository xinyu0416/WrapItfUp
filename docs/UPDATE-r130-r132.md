# WrapItfUp r130 → r132 update / 更新方式

此更新包包含 r130 到 r132 的累積變更，已包含 r131，不必先更新 r131。檔案路徑以 repository 根目錄為準，沒有額外的最外層資料夾；本次沒有需要刪除的檔案。

1. 解壓縮 `WrapItfUp-r130-to-r132-Update.zip`。
2. 將解壓後內容依原路徑覆蓋到現有 r130 repository 根目錄。務必包含 `.github/workflows/pages.yml`、`src/`、`tests/`、`tools/`、`docs/` 及根目錄檔案。若用 GitHub 網頁上傳，請上傳解壓內容，不是 ZIP 本身；確認隱藏的 `.github` 資料夾也已上傳。
3. 提交後等待 GitHub Actions 的 **Verify and deploy WrapItfUp** 成功，開啟網站確認顯示 **Public r132**。
4. 本機使用可執行 `npm ci`，再執行 `npm run release:check`；離線成品在 `preview/WrapItfUp-r132-offline.html`。

根目錄 `index.html` 是開發來源入口，需搭配 `src/`，不是單檔離線版。GitHub Actions 會把來源建置成 `dist/index.html` 再發布。更新包不包含個人專案、公司設計檔、內部 RTL 或公司工具。

This cumulative update applies directly to r130 and includes r131. Extract and overlay its contents at the existing repository root, preserving paths including `.github/workflows/pages.yml`. No deletions are required. Upload extracted files rather than the ZIP to GitHub, then wait for the verify/deploy workflow. The root HTML is the source entry; the self-contained HTML is produced by the offline build. See VERIFICATION-r132.md for the checks completed and those still pending.
