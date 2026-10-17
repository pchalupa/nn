---
"@nn/entities": patch
---

Notify subscribers when an RGA merge adds rows, including when the local collection starts empty. This advances the collection revision so cached store snapshots refresh and merged rows can be read and updated. Merging an unchanged subset no longer emits a membership-change notification.
