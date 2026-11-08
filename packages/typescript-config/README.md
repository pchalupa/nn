# @nn/typescript-config

Shared TypeScript configuration.

## Installation

```sh
npm install --save-dev @nn/typescript-config
```

## Usage

```json
{
	"extends": "@nn/typescript-config/library.json"
}
```

Use `react.json` for React projects. It adds `"jsx": "react-jsx"`. Both extend `base.json`, which turns on strict mode and bundler module resolution. Override any option in your own `compilerOptions`, as the [`extends`](https://www.typescriptlang.org/tsconfig/#extends) docs describe.
