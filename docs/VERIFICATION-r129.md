# WrapItfUp Public r129 verification / 驗證紀錄

Date: 2026-11-17 (Taipei). Base: local r128 commit `d82de68`.

## Reproduction and cause / 重現與原因

The generic load fixture uses repeated 8-bit pass-through interfaces, chained nets and four columns of instances. It is not the original company project. Before this change, an unused module invalidated both the full-project scene cache and route topology identity. The new-module action captured and rendered Top before opening its interface sheet. Route search, spacing repair, crossing analysis and repeated global layout retries all ran synchronously on the UI thread.

Baseline measured in isolated Node processes using r128 source:

| Instances | Instance pins (excludes Top pins) | Routes | Validation | Initial synchronous scene | Capture after adding unused module |
| --- | ---: | ---: | ---: | ---: | ---: |
| 4 | 32 | 20 | 8 ms | 87 ms | 29 ms |
| 8 | 128 | 72 | 12 ms | 1,163 ms | 773 ms |
| 16 | 512 | 272 | 16 ms | >12 seconds; terminated | Not reached |

## After / 修改後

Reproduce using `node tools/benchmark-graph.mjs --large`. These are scene computation/worker measurements, **not end-to-end browser rendering times**. Timings vary with CPU, load and graph shape.

| Instances | Instance pins | Quick scene | Unused-module cache lookup | Background result | Main-thread maximum 10 ms heartbeat gap |
| --- | ---: | ---: | ---: | --- | ---: |
| 4 | 32 | 14.7 ms | 0.19 ms | 199 ms; 0 invalid routes, 0 spacing issues | 10.9 ms |
| 8 | 128 | 14.1 ms | 0.20 ms | 1,138 ms; 0 invalid routes, 0 spacing issues | 11.3 ms |
| 16 | 512 | 50.3 ms | 0.22 ms | 12,973 ms; 61 invalid routes, 1,893 spacing issues reported | 17.6 ms |
| 32 | 1,024 | 51.4 ms | 0.46 ms | Stopped at 30-second limit; remains a preview | 36.7 ms |

The dense fixture deliberately congests a fixed four-column placement. Responsiveness is improved; dense layout quality is **not** claimed solved. All electrical bindings/endpoints remain represented. Existing warnings are shown rather than called a pass. More than 120 drawn routes uses one bounded repair pass: at most 48 improvement candidates, 48 spacing candidates and eight corner fixes, followed by full validation. Explicit arrange/repair/optimize continues to use the full algorithms in a worker with cancellation and a 120-second limit.

## Automated regression / 自動回歸

`npm run release:check`: 74 tests, build, public-content audit, and standalone offline build.

- Every existing r126/r128 test retained, including cascading deletions, stale Empty settings, batch operations, parameter round-trip, editing/history, lower control bars and the actual bash receiver's 18-file/15-segment reconstruction and SHA-256 checks.
- Real worker execution checks geometry endpoint identity, unchanged RTL and all work-package bytes against the same project before routing.
- Quick view retains 1,056 endpoint locations and 528 routes in the 1,024-instance-pin fixture. Quick geometry cannot be captured as a finalized snapshot or exported without full checks.
- Tests cover unused-module cache reuse, meaningful geometry/parameter/define invalidation, legacy frozen snapshots, late stale results, cancellation, timeout and unavailable Worker behavior.
- Saving a checked snapshot produces a copy; the live document and conditional undo/redo patches remain untouched.
- The stable priority queue produces exactly the same edges, endpoint coordinates and labels as r128 for the 4-instance/32-pin and 8-instance/128-pin fixtures (direct comparison against `d82de68:src/graph-scene.js`).
- Both development-script and embedded-offline worker bootstrap paths are checked; no CDN or remote processing is added.

## Browser operation / 瀏覽器實測

Tested the generated self-contained HTML via the managed local preview in Chromium.

- Loaded 16 instances / 512 instance pins. Quick graph and background progress were visible; opening a new module definition succeeded during background routing.
- Paused calculation from the visible control and confirmed the graph remained editable. Renamed Top three times; the newest name survived obsolete jobs. After background completion, three Undo operations restored the original name and three Redo operations restored the final name.
- Downloaded the actual large `.wiu.json`: 16 instances, 512 bindings, 272 route snapshots, correct final Top name. Re-read with the application loader.
- Loaded the generic five-instance ControlBar project and downloaded Top VBS from the header. UTF-16, correct r129 marker and no NaN coordinates. The current public environment uses the existing fixed-shape fallback; no Windows execution is claimed.
- Downloaded the Linux ZIP through the delivery page. 18 entries, valid CRC, and all file contents compared to the current generator.
- A screenshot records the final r129 five-instance UI. Direct local `file://` launch, other browsers and physical devices were not separately tested. Worker restrictions fail visibly without moving the heavy algorithm back onto the UI thread.

## Limits / 限制

The original company five-instance design and external tools are not available. Company gen_top execution, normal/Empty × ASIC/FPGA compilation and wiring simulation were not rerun. Existing generation regressions and byte comparisons do not replace those acceptance tests. Large SVGs still contain every pin and wire and can require zoom/pan; this change does not implement viewport virtualization. Extremely dense full layout may time out and need smaller/less congested placement or explicit repair. No claim of unlimited-size, zero-delay operation is made.
