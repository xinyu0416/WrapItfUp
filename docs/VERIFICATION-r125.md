# Public r125 verification / 驗證

Scope: repository organization and reproducible publication from the previously published Public r124.1. This release does not intentionally alter editing or generation behavior.

## Automated checks

`npm run release:check` runs:

1. **37 tests**: generic project save/load and validation; RTL parsing; Top rename and exact undo/redo; invalid-name atomicity; disclosure persistence; cascade deletion of definitions, instances, bindings and geometry; shared-source protection; scoped history; TSV/signal-table edits.
2. All **18 generated delivery files** for the frozen public project compared byte-for-byte against pre-extraction Public r124.1 output, including org, output.cfg, RTL, Empty, helpers, configuration and README.
3. The standalone RTL compared against `examples/ExampleTop.v`.
4. All retained runtime source/CSS hashes compared with the reviewed public baseline, excluding release metadata.
5. Complete rebuilt HTML compared by SHA-256 with the preceding public artifact after normalizing only its title and release metadata.
6. Build and offline generation from one builder; audit for external script/style dependencies, private manual/stencil markers, nonempty external-tool assets and application upload/network clients.

The baseline HTML SHA-256 is `13fb0e9623830a04e600f0ca15579c03b17cd00030d27e10f42b9d49e833023e`. It is recorded in `tests/source-baseline.json`; `tests/expected-public.json` contains only generic public output.

## Browser checks

The source shell and generated standalone HTML were both opened in Chromium. Both loaded Public r125 and the complete generic example with two instances, visible Top connections and the compact 62% fit. No application-origin console errors were observed; browser-extension metadata errors were unrelated to the app. This is a source/bundle smoke check, not full cross-browser coverage.

## Limits

This is regression evidence against a known public baseline, not a proof that every possible design or every old behavior is correct. The external gen_top/gen_empty executables, RTL simulation, ASIC/FPGA environment execution, Windows Visio COM execution, and cross-browser/mobile coverage are not executed by this repository's Node tests.

The source and offline forms must also be opened in a browser before release. Publication is gated on the same automated checks in GitHub Actions. A workflow that has not completed successfully must not be described as a verified deployment.
