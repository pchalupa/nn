# @goodstate/react-devtools

DevTools for Goodstate stores.

## Installation

```sh
npm install @goodstate/react-devtools
```

## Usage

Render `Devtools` next to the app root and pass it the store.

```tsx
import { Devtools } from "@goodstate/react-devtools";

root.render(
	<>
		<App />
		<Devtools store={store} />
	</>,
);
```

The panel renders only in development or under browser automation.
