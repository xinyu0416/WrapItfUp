# WrapItfUp Public r128 verification / 驗證紀錄

Date: 2026-11-17. Base: public r126, commit `5b8ed12`. This is a rebuild; the missing r127 artifact/source was not recovered.

## Automated regression / 自動回歸

`npm run release:check`: 65 tests, source build, public-content audit and standalone offline build.

| Check | Evidence and scope |
| --- | --- |
| Existing generation | Public ExampleTop RTL remains byte-identical; all 18 generated work files match the reviewed baseline apart from explicit current-version/help text. |
| ControlBar layout | Generic ControlReg plus four ChannelPort instances. Switching to a bottom bar, upper/lower pins and collapsed labels leaves module definitions, parameters, nets, bindings, assignments, RTL and work-package bytes unchanged. |
| Four-sided routing | Each of eight ControlReg pins individually placed on the bottom edge; all routes pass outward pad escape and block-moat geometry checks. |
| Wire rename | Range retained when omitted; binding, assign and Empty references updated; serialization and undo/redo restore complete state. |
| Name increment | `_p1`, `_1`, zero padding, large trailing integers, collisions and multi-row reserved names. |
| History | Text edits undo/redo locally; clean fields forward repeated shortcuts to project history. Pointer repaint waits until the click completes and coalesces duplicate jobs. |
| r126 data integrity | Removal of two outputs with 12 dependent assignments, stale Empty settings, shared ASIC/FPGA validation, batches of 9/27 removals and 10 additions, ambiguous wiring suggestions, parameter overrides and saved project recovery remain covered. |
| Linux transfer | Actual bash receiver reconstructs 18 generic files from three batches / 15 segments and verifies SHA-256. This does not execute gen_top. |
| Public/offline audit | No external scripts/styles, private manuals, company tool payloads, proprietary stencil or upload client. Every source is embedded exactly once, in order, behind the startup readiness barrier. |

## Browser operation / 瀏覽器實測

Tested the development UI and the actual standalone `WrapItfUp-r128-offline.html` served from the managed preview. No app errors were reported during the final standalone ControlBar import/export pass. Local `file://` execution was not separately driven by the browser automation; the bundle audit confirms no runtime source/CDN dependencies.

- From a blank project, added signals and edited names directly on the diagram. Enter focused the next row; Tab focused the width. Clicking from a changed name to the next input preserved the target focus.
- Three consecutive Ctrl+Z operations restored the three prior names. Ctrl+Y / Ctrl+Shift+Z / Ctrl+Y restored them in order.
- Enabled persistent multi-select, selected two signals, zoomed and dragged the blank canvas; both remained selected. Duplicating `_p1` signals produced `_p2`. Final offline duplicate returned and selected the new row.
- Invalid canvas name remained visible after switching to the table. Saving returned to diagram view and focused the red draft. Escape cancelled; valid edits then committed.
- Invalid wire names survived a graph redraw. Two invalid drafts were retained independently; cancelling the second did not allow saving the first. Saving focused the remaining draft. Correcting it to `control_req_p0` retained `[7:0]`.
- Imported the generic five-instance ControlBar project. Switched the control instance between normal and horizontal layouts; automatic minimum width became 2398 scene units, spanning the four peers. Collapsed all groups, expanded one, then undid both operations to restore all expanded groups.
- Selected `control_reg.ready_p0`, moved it to the bottom, downloaded the project and restored the draft after reload. Downloaded JSON retained the pin-side metadata. Re-reading the downloaded JSON round-tripped exactly.
- Compared the downloaded project to its pre-layout version after the one intentional wire rename: all 18 work-package file contents and RTL matched.
- Downloaded Top VBS from its visible header control: UTF-16, 196,964 bytes, correct project/version, no NaN values. This public package uses the fixed-shape fallback without dynamic GlueTo; Windows Visio execution is not claimed.
- Opened the delivery page, selected Linux work package and downloaded the ZIP. CRC check passed; all 18 entries matched generator model bytes, including normal/Empty RTL, ASIC/FPGA filelists, org, cfg, receiver/helper instructions and source RTL.

## Limits / 尚未驗證

- The original company five-instance `tx_pkt_sender_port` / `tx_pkt_sender_reg_port_sel` project and company tools are unavailable. Its normal/Empty × ASIC/FPGA gen_top execution, compilation and wiring simulation were **not** rerun. The generic five-instance fixture does not replace that acceptance test.
- This environment has no RTL compiler/simulator or Windows Visio. File generation and byte comparison are not external execution.
- Not every historical feature or browser/device permutation received fresh manual testing. The release retains the reviewed source baseline outside the explicitly changed runtime files and runs all existing regression cases.
- Bar groups collapse text labels, not electrical wires. Every pin and net remains independent. Groups are inferred from exact shared net expressions; multi-peer signals appear in a shared group, and unmatched expressions use the existing port group or an unassigned group.
- Large designs still require zoom/pan. Active input text keeps a readable minimum size. Uncommitted invalid drafts block project download and are not a substitute for saving a valid project before reload.

本次交付已驗證的內容是編輯互動、版型資料一致性、公開範例與匯出檔案。公司環境的產生、編譯、模擬與 Windows 圖面執行需另行驗收，沒有以網站檢查通過替代。
