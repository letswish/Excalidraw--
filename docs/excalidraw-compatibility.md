# Excalidraw Compatibility Notes

## Online library installation and desktop persistence

- **Affected modules:** `src/renderer/src/main.tsx`, the Electron main/preload
  integration and preload build format, and `src/shared/library.ts`.
- **Reason:** the embedded `@excalidraw/excalidraw` component does not install or
  persist public libraries unless its host wires the library callback and a
  persistence adapter.
- **Upstream surface:** `Excalidraw`'s `excalidrawAPI` and `libraryReturnUrl`
  props; the exported `useHandleLibrary` hook; `LibraryPersistenceAdapter`'s
  `{ libraryItems }` data shape; and the `#addLibrary=<url>&token=<id>` callback
  produced by `libraries.excalidraw.com`.
- **Local behavior:** Electron intercepts a non-networking
  `https://excalidraw.localhost/library` callback, forwards its hash to the
  original renderer, and persists library data in
  `<appData>/excalidraw--/libraries.json`. The upstream hook remains responsible
  for validating, downloading, restoring, merging, and displaying libraries.
- **Upgrade risk:** future Excalidraw versions may change the library callback
  keys, allowed library hosts, hook signature, persistence data shape, or
  imperative API. Recheck these boundaries before upgrading the package.
- **Verification:** `npm run build` passed. A headless production/file renderer
  run confirmed the preload bridge and canvas load, IPC persistence round-trip,
  corrupt-file backup, and a mocked official callback being consumed by
  `useHandleLibrary` with the Library sidebar opened and callback hash removed.
