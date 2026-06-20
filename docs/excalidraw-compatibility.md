# Excalidraw Compatibility Notes

## Arbitrary HTTP(S) web embeds

- **Affected module:** `src/renderer/src/main.tsx`.
- **Reason:** Excalidraw's default web-embed validator only accepts its built-in
  domain allowlist, which requires upstream changes before other sites can be
  embedded.
- **Upstream surface:** the `Excalidraw` component's `validateEmbeddable` prop
  and its iframe rendering and sandbox behavior.
- **Local behavior:** the host supplies a validator that accepts any absolute
  HTTP or HTTPS URL, including localhost, and rejects malformed URLs and other
  protocols such as `file:`, `ftp:`, `javascript:`, and `data:`. A target site
  can still prevent rendering through `X-Frame-Options` or CSP.
- **Upgrade risk:** future Excalidraw versions may change the validator
  signature, URL normalization, embed parsing, or iframe sandbox. Recheck the
  custom validator and both newly created and restored embeds when upgrading.
- **Verification:** `npm run build` passed. The validator accepted arbitrary
  HTTP(S) origins and rejected non-web and malformed URLs.

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

## Desktop document workflow and recent files

- **Affected modules:** `src/renderer/src/main.tsx`, the local document dialogs
  and styles, and the Electron main/preload document and window-lifecycle
  integration.
- **Reason:** the embedded component's browser file handles do not expose the
  stable absolute paths required for Electron recent-file history or a desktop
  save-before-open/save-before-close workflow.
- **Upstream surface:** `MainMenu` custom items; `UIOptions.canvasActions` for
  disabling the built-in load/save actions; `loadFromBlob`, `serializeAsJSON`,
  `initialData`, `ExcalidrawImperativeAPI`, and Excalidraw theme CSS variables.
- **Local behavior:** Electron owns `.excalidraw` path access, active-document
  saves, `<userData>/recent-files.json`, and the main-window close handshake.
  The renderer validates a candidate with `loadFromBlob`, compares serialized
  saved/current states, and uses the same save/discard/cancel dialog before
  opening another file or closing a dirty canvas. Confirmed closes are sent
  back through the preload bridge before Electron closes the window. Loaded
  scenes remount Excalidraw, while recent and confirmation dialogs reuse the
  upstream visual tokens without importing private Excalidraw components.
- **Upgrade risk:** future versions may change scene restoration or serialization
  shapes, imperative API methods, menu composition, `initialData` semantics, or
  the CSS variables used by the local dialogs. Recheck files with embedded
  images, dirty-state comparisons, window-close actions, shortcuts, and both
  themes after upgrades.
- **Verification:** `npm test` and `npm run build` passed. A production Electron
  DOM smoke test confirmed the canvas, custom Open/Save/Recent menu entries,
  recent-files dialog mounting and focus, and resolved Excalidraw
  background/radius tokens. The window-close guard is unit-tested; save,
  discard, cancel, and untitled Save As cancellation remain manual desktop
  checks.

## Ubuntu `.excalidraw` file association

- **Affected modules:** the Electron main/preload document integration,
  `src/renderer/src/main.tsx`, and `electron-builder.yml`.
- **Reason:** Linux desktop file activation supplies a path on the application
  command line, outside Excalidraw's browser-oriented file picker workflow.
- **Upstream surface:** Excalidraw's `.excalidraw` extension,
  `application/vnd.excalidraw+json` MIME type, `loadFromBlob`, and the scene
  candidate/commit flow described above.
- **Local behavior:** the Debian package installs shared-mime-info and desktop
  entries with a single-file `%f` argument. Electron keeps one application
  instance, normalizes cold-start and `second-instance` file arguments, and
  lets the renderer consume the latest pending path only when its document
  baseline and save-before-open UI are ready. Existing user MIME defaults are
  not overwritten.
- **Upgrade risk:** future Excalidraw versions may change the canonical MIME
  type, extension, or accepted file data shape. Electron or electron-builder
  upgrades may change Linux argument delivery, desktop metadata, or generated
  Debian maintainer scripts.
- **Verification:** `npm test`, `npm run build`, and x64 Debian packaging passed.
  The unpacked package's MIME XML, `%f` desktop entry, desktop validation, and
  MIME/desktop cache hooks were checked. Headless packaged-app smoke tests
  opened a valid path containing spaces and Chinese characters on cold start
  and through an existing instance, with both opens recorded in recent files.
