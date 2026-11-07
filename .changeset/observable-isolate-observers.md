---
"@nn/observable": patch
---

`Observable.notify` calls every observer even when one throws, then rethrows the first error, so one failing observer no longer hides the notification from the rest.
