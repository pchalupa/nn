# @nn/id

## 0.2.0

### Minor Changes

- 23da839: Ship compiled ES modules with type declarations and source maps from `dist`, so the package works without compiling TypeScript from `node_modules`.

  Import paths stay the same.

## 0.1.1

### Patch Changes

- 8abc710: Point `homepage` and `repository` to each package's own directory, so npm links open the right README and source.
- 8abc710: Document installation, requirements, and usage in the package README.

## 0.1.0

### Minor Changes

- 8fcddf4: Adds `ID.create(): string` for local UUID v4 generation without replica coordination. Import `ID` from `@nn/id`; returned strings are opaque identities with no chronological ordering guarantee.

  Requires native `globalThis.crypto.randomUUID()`. Browsers must run in a secure context. Generation errors propagate to the caller.
