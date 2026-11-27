# @goodstate/react-devtools

## 2.0.0

### Major Changes

- a91d14d: The package scope is now `@goodstate`. Replace `@nn/` with `@goodstate/` in your dependencies and imports. Nothing else in the API changed.

### Patch Changes

- a91d14d: The panel is labelled "Goodstate DevTools" and its host element carries `data-goodstate-devtools` instead of `data-nn-devtools`. Numbers now have their own syntax color.
- Updated dependencies [a91d14d]
  - @goodstate/guards@0.5.0

## 1.1.0

### Minor Changes

- f68bb96: `Devtools` accepts any object that matches the new `Inspectable` interface instead of requiring a `Store`, so the package no longer depends on `@nn/store`. A `Store` already matches `Inspectable`, so `<Devtools store={store} />` works as before.

## 1.0.1

### Patch Changes

- 79bcd03: Read the inspected store through `store.query`, so the devtools work with stores that no longer have `read()`.
- Updated dependencies [79bcd03]
  - @nn/store@5.0.0

## 1.0.0

### Major Changes

- ae43951: Adds `@nn/react-devtools`, a read-only panel for inspecting an nn `Store` while you develop.

  Render it once with your app's store:

  ```tsx
  import { Devtools } from "@nn/react-devtools";

  <Devtools store={store} />;
  ```

  A DevTools button in the bottom-right corner opens a drawer along the bottom of the page. The drawer shows the store as a tree that follows every change. Objects and arrays start collapsed and expand on click, arrays show their length, and expanded rows stay open across updates. Strings, numbers, booleans, `null`, and `undefined` are colored by type. The panel never writes to the store.

  The drawer starts closed on every page load and isn't modal, so you can keep using the app while it's open. It renders in a shadow root, so your app's CSS doesn't change it and its CSS doesn't leak into your app. It uses a fixed dark theme with IBM Plex Mono when your app already loads it, and the system monospace font otherwise.

  `Devtools` renders only when `NODE_ENV` is `development` or the page runs under browser automation, so Playwright tests can reach it. Everywhere else it renders nothing and never loads the panel code.
