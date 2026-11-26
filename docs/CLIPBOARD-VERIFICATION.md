# WrapItfUp r137 / WaveASecond R109 驗證紀錄

驗證日期: 2026-11-25. 本次範圍是兩站整個訊號的複製貼上, 波形類型註記及一致的圖面呈現. 本紀錄與歷史版本驗證分開.

## 設計與程式分工

兩站使用內容完全相同的 SignalClipboard v1 codec. 共用層只驗證與傳遞訊號定義; 各站 adapter 讀取目前整訊號選取, 再交給原有新增/命名/參數/歷史管理. 不新增另一個命名器, 不尋找或操作其他分頁, 不猜測參考時鐘, 不依來源身分合併資料. 沒有 group 就保留空白, 不把 instance 名稱自動變成群組.

WrapItfUp 的 waveType 是繪圖/波形 metadata, 不參與電氣接線合法性與 RTL 產生. WaveASecond 的 interfaceBits 保存已知位寬, 不改動波形格的時間長度. 使用者沒有設定的方向與時序仍由目的地預設決定. 詳見 [共用格式與操作](SIGNAL-CLIPBOARD.md).

## 自動檢查

| 檢查 | 結果 |
| --- | --- |
| WrapItfUp `npm run release:check` | 133/133 測試, 正式/離線建置, 發佈內容稽核通過 |
| WaveASecond `npm run release:check` | 361/361 測試, 正式/練習建置, 發佈內容稽核通過 |
| WaveASecond `npm run build:offline` + `node tools/check-offline-runtime.mjs` | 通過, 模組全內嵌, 不依賴 CDN/正式站來源 |
| 雙站共用 codec 相同, 核心雙向往返 | 通過 |
| 重複貼上, 新 ID, 空白轉底線, 尾碼遞增, 每批一次歷史 | 通過 |
| 1-bit Data, Clock, 不同 instance 8/32-bit 覆寫 | 通過 |
| 專案儲存/重新載入, RTL 更新/Define 重解析保留 metadata | 通過 |
| 不合法/過大資料先拒絕, 剪貼簿拒絕寫入不剪下, 等待時切換文件不誤改 | 通過核心與 handler 測試 |
| SVG 和三種 VBS 產生路徑的 Clock 圓圈方波 | 通過產出結構檢查 |

## 實際瀏覽器操作

在 Chrome 執行本版頁面, 最後亦開啟產出的獨立離線 HTML. 使用正常點擊和原生快捷鍵, 沒有直接修改應用程式狀態:

- 訊號表勾選多列後 Ctrl+C, 核對實際系統剪貼簿名稱/類型/位寬.
- WrapItfUp 的 Clock, 1-bit Data, 8-bit Data 貼到空白 WaveASecond, 正確建立三列.
- 貼到已有波形的圖面只追加, 同名仍保留; 再貼一次增加一批.
- WaveASecond 從名稱區 Ctrl 多選後 Ctrl+C, 貼回 WrapItfUp. enable→enable_2, data→data_2, 1-bit Data 與 8-bit 寬度保留.
- 兩站 Ctrl+Z / Ctrl+Shift+Z 一次還原/重做該批貼上. 在 WrapItfUp 連續兩次貼上 data_p1 得 data_p2, data_p3, 連續兩次復原逐批移除.
- Top 圖的名稱點選與 Ctrl 多選能複製整個 pin; Clock 類型和位寬正確. 原始名稱保留, 沒有 group 不自動分組.
- 從 WaveASecond 直接貼到 Top 接線頁, 進入原有 Top 介面並以其預設建立接腳.
- 輸入框內 Ctrl+A/C 只複製文字; 貼到文字框不新增訊號. 目前剪貼簿被普通文字取代時, 不會貼回舊的整訊號資料.
- WaveASecond 點波形格複製得到原有 WaveASecondCells; 改選名稱後複製得到 SignalClipboard. 兩個操作分流正確.
- 先複製, 再開另一個 WaveASecond 分頁, 原生 Ctrl+V 正常追加.
- 最終 WrapItfUp HTML 中 scalar 位寬輸入正常時透明, 點擊後仍能編輯; 多 bit 位寬顯示在線旁. Clock 圓圈方波在子模組與 Top 可見, pin/net 名稱不再附加完整位寬範圍.
- WaveASecond 在本次 1365px 寬度下, 中英文切換的 27 個工具列按鈕位置/寬/高逐項相同. 明暗外觀有實際查看.

WrapItfUp 原有歷史依工作頁管理. 修改子模組後回到 Top, Top 的復原可能停用; 回到該子模組仍可復原/重做剛才的修改. 本次未另改既有歷史範圍規則.

## RTL / org 相容性

以未修改的 r136 交付檔作基準, 對相同輸入執行新舊產生器, 比較每一份 .v / .org / .cfg / .f 的 SHA-256:

| 設計 | Instance 數 | 比對檔數 | 結果 |
| --- | ---: | ---: | --- |
| 通用 ExampleTop | 2 | 12 | 完全相同 |
| 較大型接線設計 | 7 | 17 | 完全相同 |
| 傳送器接線設計 | 5 | 12 | 完全相同 |
| 合計 | | 41 | 完全相同 |

另以測試修改 Top/子模組的波形 metadata, 確認 RTL, org, 完整工作包及電氣檢查結果不因該 metadata 改變. 修正了原先純 metadata 編輯可能重新排列 Top net 宣告的問題.

## 已發現並修正

1. 表格勾選框被當成文字輸入框, 擋住 Ctrl+C.
2. 圖上透明名稱操作區擋住 SVG 名稱選取.
3. 部分匯入/型別切換路徑遺失 Clock/位寬 metadata.
4. 工具列剪貼簿失敗仍可能剪下或使用過期的內部資料.
5. 非同步操作等待期間切換文件/選取, 可能套到錯誤目標.
6. 純 metadata 編輯改變 HDL 宣告順序.
7. scalar SVG 已省略 1, 但 HTML 編輯覆蓋層仍顯示 1.
8. 靜態 HTML 標題和部分 agent 說明仍是舊版標示.

## 尚未執行與限制

- 41 份輸出相同證明本次沒有改變這些產物, 不代表排除了基準版所有既有錯誤.
- 本次沒有執行公司 Linux gen_top, ASIC/FPGA 正常/Empty 編譯或模擬, 也沒有執行 Windows Visio. 產物/腳本檢查不等於那些環境執行通過.
- 實際快捷鍵測試使用 Chrome. Edge/Firefox/Safari 跨瀏覽器, macOS Cmd, OS 剪貼簿政策及各種 file:// 權限組合尚未逐一實測. 共用純文字格式不需要同一分頁或站點儲存空間; 工具列讀取被拒時提示使用 Ctrl/Cmd+V.
- 1440/1280/960px × 所有主題的完整像素驗收矩陣尚未執行. 本次記錄的中英文尺寸比對僅限上述視窗.
- 只有打包交付, 沒有更新公開網站. 交付包不包含私人設計, 公司文件, 公司 stencil 或內部 RTL.

## English verification summary

Both release gates pass: 133 WrapItfUp tests and 361 WaveASecond tests. Native Chrome interaction verified whole-signal transfer both ways, empty/existing destination, repeated paste, undo/redo, text/cell focus separation, suffix allocation and copying before opening a new destination tab. The two source trees share the same clipboard codec and retain their existing destination editing pipelines. Forty-one generated RTL/org/config artifacts remain byte-identical to r136. External Linux generation/compilation/simulation, Windows Visio execution and other browser engines were not run. These are downloadable review builds, not a live deployment.
