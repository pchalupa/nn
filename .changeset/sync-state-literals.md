---
"@nn/sync-engine": major
---

Remove the `SyncState` export. A sync engine's `state` and the value passed to `onStateChange` listeners are now plain strings: `"idle"`, `"connecting"`, `"connected"`, `"disconnected"` or `"disposed"`.

Replace each `SyncState` member with its string, or use the engine's `idle`, `connecting`, `connected` and `disconnected` getters. To name the type, use `SyncEngine["state"]`.

```ts
// Before
import { SyncState } from "@nn/sync-engine";

if (state === SyncState.Disconnected) sync.retry();

// After
if (state === "disconnected") sync.retry();
```
