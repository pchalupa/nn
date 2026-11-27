---
"@goodstate/react-devtools": patch
---

`@goodstate/react-devtools` accepts any React 19 as a peer dependency. It used to ask for exactly `react@19.3.1` and `react-dom@19.3.1`, so installing it next to another React 19 version failed with a peer conflict.
