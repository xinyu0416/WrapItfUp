# Public edition / 公開版

The public repository includes application source, generic examples, authored helper scripts, public tests and documentation. It excludes private manuals, manual page images, original external-tool source, private example projects, internal verification records and proprietary stencil payloads.

`assembly-toolchain-assets.js` contains empty `originals` and `references` objects. External tools must be supplied in the user's own environment. The application retains their input syntax and exports integration helpers; it does not redistribute those tools.

Source references and schema metadata are kept when needed for compatibility. A literal syntax keyword in an exporter is not a bundled company file. The artifact audit checks for prohibited assets and network clients; it supplements, rather than replaces, human review of new content.

The example in `examples/ExampleTop.wiu.json` is a generic two-module source/sink design with its matching Top RTL. Tests and baseline fixtures use that public project. No test or build step reads a parent workspace, private archive or company folder.

公開 repo 裡的「內部檔案」是維護網站所需的 JS、CSS、測試及工具；不是公司內部文件。開發、建置與測試都能只靠這個 repo 完成。
