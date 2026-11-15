# WrapItfUp project instructions

Maintain the public application and its reproducible source repository.

- Use **WrapItfUp** for product, repository and deliverable names. Lowercase engineering paths and npm identifiers are intentional.
- Preserve existing features, project schemas, RTL/org generation, external-tool syntax and data integrity when reorganizing UI or source.
- Distinguish module definitions, instances, electrical connections, drawing geometry and workspace state. Cascade edits must be atomic and undoable.
- Keep public examples generic. Never add private manuals, original company tool code, proprietary stencils, internal RTL or verification records.
- Work in `src/` and the source `index.html`; generated `dist/` and `preview/` are not hand-maintained source.
- Run `npm run release:check` for release changes and inspect the affected UI. Record actual evidence and limits in release notes and verification documentation.
- Do not claim external gen_top, simulation, equivalence or Visio execution unless that environment was actually run and its evidence inspected.
- Keep README usage/build guidance in Traditional Chinese and English. Explain source/build/output relationships plainly.
- Preserve the self-contained offline build. No CDN, analytics or design-upload service should be introduced as incidental infrastructure.
