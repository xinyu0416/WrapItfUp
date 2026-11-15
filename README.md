# WrapItfUp Public

A browser-based module interface and Top wiring editor. Open `index.html` locally or serve it with GitHub Pages. No build step or account is required to use the editor.

## Features

- Module interfaces, groups, parameters and RTL import
- Top instances, wiring, design checks and inline names
- Undo/redo, project save/load and local drafts
- Verilog, Empty/stub, org and Visio VBS exports
- A generic two-module example

## Public edition

This edition does not bundle internal manuals, screenshots, original external-tool scripts, internal teaching examples, or internal verification records. External code generators are separate user-supplied dependencies. Export support does not imply external-tool execution or functional equivalence verification.

Imported designs remain in the browser unless you explicitly download or share them. Hosting providers receive ordinary page requests; the application has no design-upload service.

## Deployment

Enable GitHub Pages from `main`, `/ (root)`. The committed HTML contains the application source and assets. `.nojekyll` serves it as a static site.
