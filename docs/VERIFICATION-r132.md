# WrapItfUp Public r132 — verification status / 驗證狀態

2026-11-17 (Taipei). This documents the early-review r132 build, not a claim of complete acceptance.

## Completed / 已完成

- `npm run release:check`: 89 tests passed, production build, public-content audit and standalone offline build succeeded.
- Endpoint index tests cover Top direction, group, fanout, slices, assign intermediates, NC and bidirectional pins.
- Programmatic table rendering retains editing controls and the requested source/destination column order. Navigation handler tests cover Load cycling, readable zoom, returning to the original view and no project mutation.
- Generic fixtures check outer-lane spacing, physical frame bounds, snapshot reload, RTL preservation and atomic layout undo/redo.
- A supplied dense design completed initial routing in about 2.4 seconds and explicit rerouting in about 6.4 seconds in the measured environment. The initial new scene's 210 outer vertical segments had zero foreign-net overlap/spacing violations; minimum clear gap was 26.7 units versus the 14-unit vertical requirement. Invalid paths and frame overflow were zero in that scene. Older snapshot rerouting also completed in about 6.5 seconds. Timings are not guarantees for other computers.

## Pending and limits / 未完成與限制

- Live browser inspection of r132 was blocked by the preview access policy. Programmatic handler/HTML checks do not establish actual browser click behavior or visual acceptance.
- Full supplied-project save/reload, output-package/RTL before-after comparison and manual workflow review remain pending.
- Interior congestion persists. The explicit-reroute result still reports 2,428 close-parallel pairs, 1,981 overlaps and 16,062 unresolved crossing events. These are geometry diagnostics, not missing electrical connections.
- Fine repair has an approximately 8-second search budget, followed by geometry checks; a measured saved-scene case returned after about 14.3 seconds without accepting a worse result. The UI worker has a 30-second overall timeout and retains the original design on failure.
- Locked blocks and saved manual geometry are preserved unless the user explicitly chooses an operation that replaces them. An old drawing requires an explicit reroute preview to adopt the new outer lanes.
- No company gen_top/gen_empty, ASIC/FPGA compilation or simulation, or Windows Visio execution is claimed for r132.

本版依使用者要求先交付試用。自動測試與打包已完成，人工介面及完整大型專案輸出比對仍待進行；沒有將圖面檢查當作 Linux 產生或模擬通過。
