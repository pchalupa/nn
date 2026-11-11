---
"@nn/react-devtools": major
---

Adds `@nn/react-devtools`, a read-only panel for inspecting an nn `Store` while you develop.

Render it once with your app's store:

```tsx
import { Devtools } from "@nn/react-devtools";

<Devtools store={store} />;
```

A DevTools button in the bottom-right corner opens a drawer along the bottom of the page. The drawer shows the store as a tree that follows every change. Objects and arrays start collapsed and expand on click, arrays show their length, and expanded rows stay open across updates. Strings, numbers, booleans, `null`, and `undefined` are colored by type. The panel never writes to the store.

The drawer starts closed on every page load and isn't modal, so you can keep using the app while it's open. It renders in a shadow root, so your app's CSS doesn't change it and its CSS doesn't leak into your app. It uses a fixed dark theme with IBM Plex Mono when your app already loads it, and the system monospace font otherwise.

`Devtools` renders only when `NODE_ENV` is `development` or the page runs under browser automation, so Playwright tests can reach it. Everywhere else it renders nothing and never loads the panel code.
