# Repository Guide

- `packages/*` are public `@nn/*` libraries; `apps/*` are private examples. Library export maps point directly at `src/*.ts`, so consumers compile source and there is no library build output.
- `apps/example-server` is standalone. `pnpm dev` starts it on port 3001 and the React app on port 3000 using the committed development env files.
- Do not use TypeScript type casts (`as Type` or `<Type>value`); narrow or model the type correctly instead.
- Add a Changeset for consumer-visible changes to public `@nn/*` packages. `example-react` and `example-server` are ignored by Changesets.
- Never run `git commit` unless the user explicitly asks for it.
