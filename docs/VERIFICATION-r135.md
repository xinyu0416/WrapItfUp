# WrapItfUp r135 verification

## 匯出行為

在「產生 RTL／gen_top → Linux 工作包 → 檔案清單與個別預覽」開啟 Top 的 .v.org。格式選項、實例與參數覆寫、Top I/O、內部接線、特殊處理依序分節。Top I/O 保留設計的 RTL 宣告次序。具名內部 wire 的整條接線與固定位元切片列在宣告下方。其他運算式、跨訊號串接及刻意空接仍保留各端點。

匯入可辨識的章節和群組時，原有的巢狀分組、保留區標題、空 FPGA 區段和接腳說明可往返。含作用中條件或手寫語法的來源繼續走原文檢查。Top 參數面板說明與實際匯出一致。Empty 頁面會顯示 ASIC／FPGA 工作包錯誤，並標示目前單一組態能否下載。

## Regression coverage

The public regression suite covers file previews and downloads, save and reload, instance overrides, clock and width compatibility transforms, explicit opens, slices, guarded manual source, and normal/Empty delivery. New org tests check section order, uninterrupted Top declarations, wire adjacency, nested and empty groups, preserved bit-zero interfaces, body parameters and same-name loads on Top outputs.

The public fixture compares the entire file set against checked-in expectations. The org fixture now records the revised layout. Independent normal RTL and other design-file snapshots retain their previous expectations. The offline and hosted builds passed the public-content audit.

In the browser, the built-in example opened the Linux package and its org preview with all five headings. Manual Ctrl+A and Ctrl+C in the file body matched the complete preview byte-for-byte. The browser's automatic clipboard readback returned an empty value; the UI reported the failure and selected the fallback text.

Company gen_top generation and target ASIC/FPGA compilation and simulation require their respective external environments.
