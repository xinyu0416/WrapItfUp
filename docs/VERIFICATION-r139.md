# WrapItfUp Public r139 verification

2026-11-26. This revision changes only the Clock control appearance and release metadata. The application JavaScript is byte-identical to r138 except for release.js.

- Inactive: unfilled gray dashed circle with gray square wave.
- Active: solid black circle with white square wave, drawn above the circle.
- Hover and keyboard focus provide an outer focus ring, without changing the symbol fill or dash state.
- Existing visibility rules remain: inactive controls appear on port hover/selection/focus; active Clock controls remain visible.

Chrome inspected the actual r139 offline artifact through the local preview. An active left Clock and an inactive port during name editing were shown together. Computed styles confirmed inactive fill=none and dash=2.2px 2.2px, while active fill=#111, no dash and waveform=#fff. The right-side control and Undo restored the correct dashed inactive symbol. The solid icon does not depend on hover or editing state.

npm run release:check passed: 141 tests, 0 failures, 0 skips; hosted build, offline build and public-content audit passed. No new behavior-only tests were added for this reversible styling change. r138 generator tests and all existing public org/RTL snapshots passed. No company gen_top, ASIC/FPGA compilation, simulation or Windows Visio was executed in this visual update.
