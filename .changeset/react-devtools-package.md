---
"@nn/react-devtools": major
---

Adds `@nn/react-devtools`, read-only devtools for nn stores.

The panel shows a tree of the store's values and briefly flashes a row when its value changes. Click a map or list to expand it. Lists show their item count. Selecting a row shows its CRDT metadata in a side pane: the kind and merge rule, when it was written with its counter and replica, and the entity key. Values that were never written are labelled as schema defaults. The panel never writes to the store.

Render it once with your app's `Store`:

```tsx
<Devtools store={store} />
```

It adds a small ⚙️ button in the bottom-right corner that opens a drawer along the bottom of the page. Close it with the Close button or Escape. It starts closed on every page load. The drawer isn't modal, so you can keep using the app while you watch values change, but it sits behind the app's own `showModal()` dialogs while one is open. It renders nothing under browser automation, so Playwright runs don't see it.

The devtools use a dark theme.

`Devtools` renders only when `NODE_ENV` is `development`, and production builds leave it out.
