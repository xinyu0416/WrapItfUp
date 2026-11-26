# WrapItfUp Public r138 verification

Date: 2026-11-26. Scope: block/interface name editing and direct Clock controls.

## Changes

- Focused names keep their port-side edge fixed. Left names grow right; right names grow left. The input remains readable at reduced diagram zoom.
- Removed older CSS rules that clipped the active input, painted the stale label over it, or hid its caret. Idle labels retain their existing clipped presentation.
- The existing draft keyboard controller now handles Escape, Enter and Tab before legacy shortcuts. Escape restores the draft before blur; Enter/Tab retain one commit. IME composition is protected from legacy shortcuts.
- Each port has a circle/square-wave Clock button. It appears when the port is hovered, selected or keyboard-focused, and stays visible while marked. The hit location does not shift when toggled.
- One diagram button changes only its own signal. The signal table retains batch editing. Both use one type-update path and the existing history transaction.
- Clock cancellation restores the previous explicit non-clock type, including one-bit Data. This optional metadata survives local save/load and native same-app copies. Cross-app clipboard rows continue to carry only the agreed current waveform type, width, name and group. A foreign Clock without a prior local type returns to Auto when cleared.
- Top interface and module definitions retain their separate scopes. Clock metadata does not change names, directions, widths or connections.

## Browser checks

Chrome, actual rendered source and the final self-contained HTML served from the local preview:

- Right input at 100%, 70% and 58% zoom: right edge equals the original name-cell edge; expanded input remains approximately 130 CSS pixels wide. Left input retains its left edge. Long draft text, caret and selection are visible instead of being clipped to the idle name width.
- Right and left name drafts cancel on Escape; the next clicked input receives focus without a shared-interface rename dialog.
- Enter on a valid right-side rename opens the existing shared-interface confirmation once; confirmation applies it, and one Undo restores the original name.
- A right-side one-bit port explicitly set to Data can be marked Clock and cleared back to Data. Ctrl+Z and Ctrl+Shift+Z restore the expected states.
- Left-side Clock, button Space and Enter, Top-interface Clock and Undo were exercised. Undoing a Top Clock change leaves the module definition's Clock setting intact.
- The final offline HTML opens as Public r138. Its right-side editor, Escape cancellation and Clock button were retested. The file was served locally for browser inspection; file:// on the user's PC was not separately exercised.

## Automated checks

`npm run release:check`: 141 tests passed, 0 failed, 0 skipped. Hosted build, offline build and public-content audit passed. The two generated HTML files are byte-identical and embed all scripts/styles without external application dependencies.

New behavioral regressions cover actual competing keyboard event registrations, Escape followed by blur, single Enter/Tab commits, IME handling, type restoration, single-transaction history, live signal lookup after a pending edit replaces state, native/cross-app clipboard boundaries and workbook save/reload.

Independent comparison against the immutable r137 source used three generic designs with widths 1, 8 and 32, and seven generation outputs per design. All 21 outputs match, including normal RTL, compatibility RTL/org, Empty RTL, cfg and source. Twelve additional Clock variants cover module/Top ports and direction-independent drawing sides. RTL reimport and Defines reparse also retain the previous explicit Data type. Existing reviewed public org/RTL snapshots passed unchanged.

## Limits

No company gen_top executable, company ASIC/FPGA compile/simulation environment or Windows Visio was run in this change. The generator comparison proves unchanged output for the stated fixtures, not a fresh external-tool certification. The previous user's large proprietary five-instance design was not available in this recovered source and was not rerun. This release changes block editing and waveform metadata; it does not claim new routing or large-project performance results.
