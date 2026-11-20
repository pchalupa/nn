# Repository Guide

- `packages/*` are public `@nn/*` libraries, except the private `@nn/build-config`, `@nn/test-config` and `@nn/typescript-config`; `apps/*` are private examples.
- Library `exports` are generated: edit the entries in a package's `tsdown.config.ts`, then run `pnpm build` to rewrite `exports` and `publishConfig.exports`.
- In the workspace, library `exports` resolve to `src/*.ts`, so everything runs on source without a build. Only `pnpm pack` and `pnpm publish` swap in `publishConfig.exports` from `dist`, so publish through pnpm (`changeset publish` uses it) and never `npm publish`.
- Do not use TypeScript type casts (`as Type` or `<Type>value`); narrow or model the type correctly instead.
- `any` is prohibited. Type values of unknown shape as `unknown` and narrow them before use.
- Prefer `if` statements over ternary operators.
- Name files and directories in kebab-case. TanStack route files under `apps/example-react/src/routes` are exempt because their names define the routes.
- Document exported APIs with JSDoc: a one-line summary. Let names, signatures and types carry everything else.
- Give internal code at most a one-line JSDoc summary for navigation.
- Express intent through names and structure; reserve comments for JSDoc.
- Add a Changeset for consumer-visible changes to public `@nn/*` packages. `example-react` is ignored by Changesets.
- Never run `git commit` or post replies to PR comments unless the user explicitly asks for it.
