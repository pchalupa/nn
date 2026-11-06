# Repository Guide

- `packages/*` are public `@nn/*` libraries; `apps/*` are private examples. Library export maps point directly at `src/*.ts`, so consumers compile source and there is no library build output.
- Do not use TypeScript type casts (`as Type` or `<Type>value`); narrow or model the type correctly instead.
- `any` is prohibited. Type values of unknown shape as `unknown` and narrow them before use.
- Name files and directories in kebab-case. TanStack route files under `apps/example-react/src/routes` are exempt because their names define the routes.
- Avoid code comments.
- Add a Changeset for consumer-visible changes to public `@nn/*` packages. `example-react` is ignored by Changesets.
- Never run `git commit` or post replies to PR comments unless the user explicitly asks for it.
