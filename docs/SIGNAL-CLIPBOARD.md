# 跨站訊號複製貼上 / Signal clipboard

整列複製由來源產生 SignalClipboard v1 純文字 JSON，兩站使用相同 codec。來源負責描述訊號，目的地負責建立資料、預設值、名稱規則和歷史紀錄。每次貼上建立新物件。

## 操作

- WrapItfUp 選取完整接腳或訊號列。WaveASecond 選取名稱區代表整個訊號。
- Ctrl/Cmd+C 複製，Ctrl/Cmd+V 在目的編輯器貼上。文字輸入框仍使用文字複製貼上。
- WaveASecond 外來訊號追加到底部，使用全圖時間軸；參考 Clock 由使用者指定。
- WrapItfUp 外來訊號沿用現有貼上入口與命名 allocator。空白整理成底線，名稱衝突依尾端數字遞增或加 _2。
- 所有批次變更由目的網站既有歷史管理提交，整批可復原與重做。
- 同一網站的既有複製功能可以保留 native 資料，另一個網站只讀取共用訊號定義。

## 格式 / Format

Envelope fields are format=SignalClipboard, version=1, source, signals and optional native.
Each signal has name, bits (known bit count or preserved width expression), waveType (signal/data/clock) and group.
Names may repeat or be empty in transport. Each destination applies its existing name rules.
The native field is interpreted only by its owning application. No scripts or executable content are evaluated.
An unsupported version or malformed recognized payload fails before any partial commit.
Both projects keep an identical signal-clipboard.js, checked by integration validation.

## Application boundaries

WrapItfUp uses its existing port allocator, paste command, parameter handling, electrical validator and undo transaction.
WaveASecond uses its existing row factory, document validator, history commit and default global timeline.
Clipboard events read the current system payload, with explicit editing focus taking precedence.
Data/Signal/Clock are waveform representations. A one-bit Data port is valid.
Waveform classification never changes electrical width or direction and never emits assignments or ties.
