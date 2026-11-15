# Public r126 verification / 驗證紀錄

Date: 2026-11-15 UTC. Public generic fixtures only. This report records what was actually run; it does not import historical private results as current evidence.

## Automated checks

`npm run release:check` passed: **53 tests, 0 failures**, Pages build, public artifact audit, and standalone build. Node tests execute the real application data modules.

| Case | Evidence / result |
| --- | --- |
| Two deleted Top outputs | 12 referring assignments and two Empty ties removed in one transaction; undo and redo restore/reapply the whole change |
| Binding cleanup | Removed net references become unconfigured pins, not invented NC/constant bindings; exact identifiers and comments respected |
| Opaque input | Unsupported references reject the deletion before mutation |
| Orphan Empty settings | Missing and duplicate outputs are reported by the shared validator; export rejects unresolved settings and succeeds after repair |
| Batch deletion | 9 and 27 pins removed from a 40-output generic fixture with matching assignments and Empty ties |
| Batch creation | 10 inputs added together, preserving existing instance connections |
| Wiring suggestions | Four generic port instances plus one distributor pair both directions by channel; ambiguous candidates remain separate; incompatible widths/signedness excluded; Top exposure explicit |
| Paste review | Tab and unambiguous whitespace accepted, expression spaces preserved, malformed format consolidated, exact error rows returned |
| Parameters | Different instances use WIDTH=16 and WIDTH=32 while others keep default 8; save/load, RTL/org and work-package exports stay consistent |
| Actual Linux receiver | Bash process receives 18 authored test files in 15 segments / 3 batches; receiver checks every SHA-256 and tests compare reconstructed bytes |
| Export regression | Original 18-file generic baseline retained; only four intended current-version/documentation differences allowed. RTL/org/cfg, source bytes, filelists and execution helper behavior remain compared |
| Offline build | Every current script embedded exactly once in order; no CDN/runtime source fetch; startup visibility barrier included |

## Browser interaction

Tested the source UI in Chromium through ordinary user controls:

- Imported a project with two orphan Empty ties; “only errors” displayed both. Reassigned one to a live output and removed the other, previewed and applied, then verified export was enabled. One undo restored the original stale settings; redo restored the repair.
- Repeated the orphan case with **zero live Top outputs**. The editor still opened, showed both errors, and allowed removing them. The diff said “remove this setting”; export became available.
- Deleted 9 and then 27 selected Top rows. The confirmation listed all declarations and counts of matching assigns and ties. One undo restored all rows.
- In the 42-pin browser fixture, the 27-row preview appeared in about 1.4 seconds; applying it took about 0.3 seconds. Adding 10 rows through paste preview took about 0.6 seconds, followed by a successful single undo. These are one local browser measurement, including automation overhead, not a performance guarantee for the private design or every machine.
- Connected the generic five-instance case using the suggestion preview: 16 endpoint bindings, 8 internal nets, no Top promotion. Preview checked both distributor→port and port→distributor directions.
- Pasted whitespace and Tab rows, an unknown signal and malformed row. Errors appeared on editable rows; correcting them and rechecking allowed one batch apply.
- Changed instance WIDTH from default 8 to override 16. The settings summary and SVG diagram showed “this instance override”; the other three instances retained “module default”. Undid the change.
- Verified clipboard content `bash` and explicit Enter guidance. Captured the actual displayed receiver command and batches, executed them in a local bash process, then pasted its genuine receipt back into the website. This second package had 18 files / 8 segments / 2 batches. The UI marked receipt/hash confirmation while keeping generation and compilation/simulation **unconfirmed**.
- Source startup showed the current home screen. The code/build readiness barrier was checked; no frame-by-frame recording or latency guarantee is claimed.

## External acceptance still required

The exact five-instance project from the reported field session and its company execution environment were unavailable. Generic tests are not a substitute. No private material is published in this repository.

| Target case | gen_top / gen_empty | Compile | Wiring simulation |
| --- | --- | --- | --- |
| Actual design, ASIC normal | Not rerun | Not rerun | Not rerun |
| Actual design, FPGA normal | Not rerun | Not rerun | Not rerun |
| Actual design, ASIC Empty | Not rerun | Not rerun | Not rerun |
| Actual design, FPGA Empty | Not rerun | Not rerun | Not rerun |

To complete acceptance, load the original `.wiu.json` privately, repair stale settings through the UI, save/reopen, export and transfer, then execute the target environment's tools. Record generated output and the appropriate separate normal/Empty filelists, compiler exit status/log/new artifact, and simulation PASS. Exercise different parameter values per instance separately from the defaults-only case.

The csh condition is handled by an explicit switch to bash; a real csh session was not available locally. KVM typing speed and screen delay were not measured here. Company tool availability and permissions, private source versions, actual csh startup, and Windows/Visio output remain environment-specific checks. No RTL generator failure is inferred from those environmental limitations.
