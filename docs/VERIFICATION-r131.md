# WrapItfUp Public r131 verification / 驗證紀錄

Date: 2026-11-17 (Taipei). Implementation base: r130 commit `1a17c89`. This is an issue-review and drawing-space repair release. It does not change the electrical schema or RTL/org generators.

## What failed / 原因

The check page emphasized a generic help paragraph; the actual instance and pin were secondary text. r131 renders the same validation objects as a table with status, instance/object, pin, current binding, reason and optional navigation. Reading the error no longer requires opening the editor. Long help remains optional.

Explicit layout actions called `prepare(..., {force:true})`, while track expansion required `!force`. Manual repair therefore excluded expansion. The expansion code also treated every saved block position as pinned, rather than only explicit layout locks. r130's dense-interactive performance path stopped expensive automatic global repair, making this broken explicit recovery path more consequential.

r131 restores explicit expansion and compares original, expanded and rerouted candidates. A candidate cannot increase invalid paths, close-parallel pairs, overlaps or unresolved crossings. Locked blocks must retain position and dimensions. Horizontal control bars stay rigid. Apply is one undoable transaction; cancellation and a no-improvement result retain the original project. Expensive legacy local repair remains separately available as **精細局部修復（較慢）**, running in the cancellable worker.

## Actual supplied design / 實際設計測試

The private design was used locally, without publishing its source, signal list, project JSON or screenshots. It contains seven instances, 878 instance pins and 532 nets; drawing has 550 routes. The input has 46 unconfigured-pin errors and one warning.

| Metric | Before | After explicit repair |
| --- | ---: | ---: |
| Diagram width | 8,435.48 | 8,951.48 |
| Diagram height | 12,068 | 19,684 |
| Invalid/safety paths | 0 | 0 |
| Close-parallel pairs | 8,858 | 6,797 |
| Collinear overlaps | 7,493 | 5,957 |
| Crossings without safe jump markers | 36,010 | 33,537 |
| Electrical validation errors | 46 | 46 |

Worker computation took 5,763 ms in the measured environment. This is not a hardware-independent guarantee. Diagnostic counts are geometry pairs/events, not counts of missing electrical connections.

The result improves congestion but does **not** clear it. No all-clear geometry claim is made. A larger canvas is deliberately part of the result; fitting it all on screen makes text smaller, while readable zoom and viewport rendering remain available.

Checked programmatically on the actual design: all top-level electrical fields unchanged, all route source/target/net identities unchanged, validation objects identical, allow-errors RTL **preview** byte-identical, project save/read round-trip identical, and one undo/redo restores exact before/after projects. Normal RTL/work-package export remains blocked by the 46 existing unconfigured pins.

Chromium inspection of the generated standalone HTML through a local preview:

- Check page showed 47 direct rows (46 errors plus one warning), with visible instance, signal and reason. The first navigation button located the corresponding unconfigured connection row.
- Repair displayed before/after dimensions and conflict counts before applying. Cancel left the original 8,858 spacing count.
- Apply changed spacing to 6,797; one Undo returned it to 8,858; one Redo restored 6,797. The electrical error badge stayed at 46.

## Related prior requirements / 相關舊需求盤點

Reviewed against the user's r109 requirement inventory, especially TOP-07–10, ROUTE-01–12 and VIS-03–08. This table distinguishes tested behavior from retained code and limitations; it is not certification of every historical feature.

| Requirement | r131 status and evidence |
| --- | --- |
| See exactly which pin is unfinished | Fixed; all 46 pins visible directly, generic regression plus actual browser inspection |
| ROUTE-08: expand space when lanes are too close | Explicit repair restored and measured above; remains partial because many conflicts persist |
| TOP-08 / ROUTE-08: fully optimized first drawing | Not fully restored for dense automatic opening. It retains bounded routing for responsiveness; explicit repair performs expansion. This remains a gap against the older automatic-first-pass goal |
| ROUTE-01: direct aligned routes and few bends | Retained; bounded-router regression verifies direct routes and obstacle detours. No global minimum-bend guarantee |
| ROUTE-02–03: block/pad avoidance and 2-pad escape area | Retained in full geometry validation and bounded-router tests; actual repair did not add safety errors |
| ROUTE-04: horizontal 2P / vertical 1P clearance | Retained (`P=14`, required gaps 28/14); measured after repair, not relaxed to make the counts pass |
| ROUTE-05–07: cap/bridge clearance, junctions and crossings | Existing wire-geometry and spacing analysis retained; unresolved crossings remain explicit. Historical adversarial bridge/Visio cases were not all replayed |
| ROUTE-09: preserve current layout during ordinary wiring/editing | Existing cached/frozen geometry path retained; save and scoped-history regressions rerun |
| TOP-10: manual paths and explicit locked blocks | Repair preserves manual paths; dense lock regression checks x/y/width/height. Full automatic rerouting explicitly permits replacing manual paths |
| ROUTE-10: line labels and full-name appendix | Existing scene-label and appendix code retained. This release does not guarantee every crowded label becomes readable |
| ROUTE-11: locate geometry problems | Existing per-net/coordinate diagnostic navigation retained by source review; actual browser test covered electrical issue navigation, not every geometry issue type |
| ROUTE-12: dense design plus electrical parity | Actual seven-instance input and generic 16-instance dense worker tested; original historical Group 13 Windows case not rerun |
| VIS-03 / VIS-07: pad direction without redundant wire arrows; omit known 1-bit widths | Existing scene rules retained by source review; no new exhaustive module/VBS visual test |
| VIS-06: complete scene and export | Full-scene/viewport separation, VBS worker generation and unchanged RTL/work-package regression pass; Windows Visio execution not run |
| Horizontal control block, pin sides and group collapse | Existing ControlBar layout/electrical parity tests pass; new expansion test protects bar dimensions |
| Name suffix increment, wire rename and field Undo/Redo | Existing `_p1`/padded suffix, range-preserving rename and local-vs-project history tests pass |
| Cascade deletion, orphan Empty settings and batch edits | Existing 12-assign deletion, 9/27-pin deletion, 10-pin addition and shared Empty validation tests pass |
| Per-instance parameters and Linux transfer | Existing independent overrides save/reload/org/RTL tests and real bash 18-file transfer/hash test pass |

The existing space transform does not stack a second expansion over an already expanded snapshot, and automatic expansion is skipped when manual routes are present. Rerouting or fine repair may still improve those cases. Explicit locks constrain where space can be inserted. The UI reports no improvement instead of committing a cosmetic history entry. Dense fine repair can reach the worker timeout; cancellation remains available.

## Reproducible verification / 可重現驗證

`npm run release:check`: **83 tests passed**, then self-contained build, public-content audit and offline build passed. New coverage includes direct identification of all pending pins, horizontal/locked block rigidity, dense explicit expansion, electrical/route parity, serialization, one-step undo/redo, truthful no-op repair and preserved fine-repair entry point.

Company gen_top/gen_empty, ASIC/FPGA Normal/Empty compilation, wiring simulation and Windows Visio were **not run**. Historical successes are not results for r131. Browser validation, byte parity and generic tests do not establish external-tool correctness. The original private JSON is unchanged and excluded from public deliverables.
