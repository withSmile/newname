# Export format validation

Validated on 2026-10-18.

| Content | React JS | React TS | Vue JS | Vue TS |
| --- | --- | --- | --- | --- |
| 3D scene | Bundle passed | Bundle + public typecheck passed | SFC compile + bundle passed | SFC compile + bundle + public typecheck passed |
| UI canvas | Bundle passed | Bundle + public typecheck passed | SFC compile + bundle passed | SFC compile + bundle + public typecheck passed |
| Composite | Bundle passed | Bundle + public typecheck passed | SFC compile + bundle passed | SFC compile + bundle + public typecheck passed |

Both empty UI configuration and populated UI templates were checked. The audit compiles actual Vue SFC scripts and templates, resolves generated relative imports, bundles each exported entry, and runs TypeScript strict checks on exported components/configuration/public interfaces. Generated Three.js runtime implementations retain `@ts-nocheck`; their internals are covered by runtime tests rather than full static typing. Third-party packages are external in the bundle audit, as these outputs are reusable component packages.

The React JS NOVA export was also run in the browser with copied GLB resources. The global lock, rejected edits, unlock/edit API, smooth sphere, model visibility, flow rings, particles, animation and performance display were checked. This does not constitute browser interaction acceptance for every framework/content combination or every supported model/effect preset.

Corrections from this audit:

- Vue entry points re-export SFC defaults as named public components.
- TypeScript UI configuration declares optional background and node fields, including the empty-canvas case.
- Removed a duplicated material `side` key.
- README import examples select the correct scene/UI/composite entry component.

To repeat the isolated audit without adding Vue to the editor runtime:

```powershell
npm install --prefix node_modules/.cache/frame-export-audit --no-save --no-package-lock @vue/compiler-sfc@3 vue@3 typescript@5 @types/react@19 @types/three@0.180
node scripts/audit-export-formats.mjs
node --test tests/*.test.js
```

Existing exported archives must be regenerated to receive these changes. ZIP and directory export use the same file-generation pipeline; directory permissions and browser download prompts remain browser-dependent.
