---
"@nn/sync-engine": minor
---

`pull(name)` is optional, so a subclass whose transport delivers the stored state through `receive()` while it opens, such as an event stream or a broadcast channel, no longer needs an empty `pull()`. An engine without `pull()` connects and pushes every field as soon as `open()` resolves. Subclasses that implement `pull()` keep working unchanged.
