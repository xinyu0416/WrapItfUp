# WrapItfUp Public r130 verification / 驗證紀錄

Date: 2026-11-17 (Taipei). Base: r129 commit `8415e0d`.

## Actual supplied project / 實際專案

The private input was tested locally and is not included in this repository or the public deliverable. Aggregate size: 1,341,964 bytes, seven module definitions, seven instances, 878 instance pins, 532 nets, 832 bindings, zero assigns. Its saved route snapshot no longer matched its topology. Rebuilding represents 1,128 endpoints and 550 drawn routes.

Measured in the same local environment, without hardware throttling. Worker timings are computation timings, not end-to-end browser interaction times.

| Stage | r129 baseline | r130 |
| --- | ---: | ---: |
| JSON read/normalization | about 122 ms | 64–122 ms across runs |
| Electrical validation | about 16 ms | about 16 ms |
| Background geometry | still unfinished at 30-second timeout | 2,326–2,880 ms |
| Sampled worker JS heap at progress messages | up to 64 MB before timeout | up to 26 MB |
| Graph DOM at saved readable viewport | 10,744 elements | about 800 elements |
| Largest observed browser main-thread task in tested initial-load/graph sequence | about 897 ms | about 376–418 ms |

The browser page JS heap was roughly 35–39 MB in the baseline and varied around 74–95 MB during the later edit/search session before garbage collection. These readings are not total browser/GPU memory and are not a like-for-like memory-reduction claim. The strongest evidence is excessive CPU work in obstacle search/spacing repair and unnecessary DOM/layout/paint work. File bytes alone do not determine browser memory.

At 8% overview zoom, about 2,095 graph elements remained instead of approximately 9,575 without the overview detail filter. At an 85% searched detail view, about 590 remained. Full-scene geometry and all endpoints remain available independently of this view.

## Implementation and limits / 修正與限制

- More than 200 bindings uses a bounded orthogonal candidate router in interactive workers. It checks endpoint escape directions and obstacle moats; fallback visibility-grid search has a 4,096-iteration ceiling. Unroutable paths remain reported, never silently certified.
- Dense automatic opening no longer invokes the expensive global spacing/corner repairs. Full final route/spacing/crossing analysis still runs. Explicit arrange/repair/optimize retains the original algorithms with cancellation and timeout.
- More than 400 endpoint locations enables viewport rendering with an overscan margin. Crossing wires are kept even with both endpoints offscreen. Below 35% zoom, unreadable pin and wire-name controls are omitted; zooming in restores them.
- Full scene/model remains the export source. Search locates model coordinates even when a pin is absent from DOM. Active inline editing prevents viewport replacement; draft wire values are restored across later view updates.
- VBS export builds checked background geometry before attaching a drawing snapshot to a project copy. Worker dependencies now include bundle normalization, matching the main-thread project serializer.

Completion is not a layout-quality pass. The supplied graph still reports 8,858 close-parallel pairs, 7,493 overlaps and 36,010 crossings that cannot receive a safe jump marker. These are drawing diagnostics, not missing electrical bindings. This release improves responsiveness, not all layout congestion. Dense graphs and explicit full repair can still reach the timeout.

## Regression / 回歸

`npm run release:check`: 78 tests, self-contained build, public-content audit and offline build.

New coverage includes four endpoint directions, obstacle clearance, direct straight routes, crossing-wire culling, overview/detail restoration, complete full SVG, unchanged RTL, real dense-worker route endpoints and immediate VBS export. Existing cascade-delete, stale Empty, batch edit, name suffix, multi-selection/history, parameters, ControlBar and real bash receiver tests remain included. The generic dense-worker regression compares every work-package file against its pre-routing value.

`node tools/benchmark-graph.mjs --large` is reproducible without private data:

| Instances | Instance pins | Quick scene | Background result | Invalid paths reported | Spacing pairs reported |
| --- | ---: | ---: | ---: | ---: | ---: |
| 4 | 32 | 11.4 ms | 153 ms | 0 | 0 |
| 8 | 128 | 9.3 ms | 1,060 ms | 0 | 0 |
| 16 | 512 | 21.6 ms | 495 ms | 8 | 1,027 |
| 32 | 1,024 | 44.9 ms | 681 ms | 10 | 2,721 |

Different sizes cross different routing thresholds; this is not a smooth scaling curve. The synthetic four-column layout is deliberately congested. All conflicts remain reported.

## Browser and data integrity / 瀏覽器與資料一致性

Chromium, generated standalone HTML through the local preview:

- Opened the supplied design, waited for completed background checks, switched between 8% overview and readable detail, and panned with the keyboard.
- Searched an offscreen Top/submodule signal and an internal net; search zoomed to the actual endpoint/label and restored its controls.
- Created an unused module, opened its interface page, returned to Top, and undid creation back to the original seven modules.
- Edited a visible internal wire name and cancelled with Escape; its original name/range returned.
- Downloaded the actual project after these operations and read it through the application loader. Every top-level electrical field (including all module definitions, instance values, nets, connections, assigns, RTL sources, parameters and defines) matched the original normalized input. The saved scene contains all 550 routes.
- Validation results matched exactly: 46 pre-existing UNCONFIGURED_PIN errors and one tri-state warning. RTL **preview** using the existing allow-errors preview option matched byte-for-byte. Normal RTL/work-package export remains blocked by those input errors; no corrected company design is claimed.

The final r130 build also loaded the public five-instance ControlBar fixture and downloaded its VBS and Linux ZIP through the UI. VBS is UTF-16 with the r130 marker and no NaN coordinates; the existing fixed-geometry fallback is disclosed. All 18 ZIP entries passed CRC and matched the current generator byte-for-byte. The final screenshot uses this generic fixture, not the private design.

Company gen_top/gen_empty execution, ASIC/FPGA normal/Empty compilation, wiring simulation and Windows Visio execution were not run. Physical Windows browsers, other engines, GPU memory and direct `file://` Worker behavior were not separately measured. Offline dependency embedding is checked, but it is not a substitute for those environment tests.
