# Repository Guide

- `packages/*` are public `@nn/*` libraries, except the private `@nn/build-config` and `@nn/typescript-config`; `apps/*` are private examples.
- Library `exports` are generated: edit the entries in a package's `tsdown.config.ts`, then run `pnpm build` to rewrite `exports` and `publishConfig.exports`.
- The `@nn/source` export condition resolves `@nn/*` imports to `src/*.ts`, so the workspace runs on source without a build. Any new tool or app that imports `@nn/*` opts into it: `customConditions` in tsconfig, `sourceConditions` from `@nn/build-config/vite` in Vite or Vitest, `--conditions=@nn/source` in Node or tsx.
- Do not use TypeScript type casts (`as Type` or `<Type>value`); narrow or model the type correctly instead.
- `any` is prohibited. Type values of unknown shape as `unknown` and narrow them before use.
- Name files and directories in kebab-case. TanStack route files under `apps/example-react/src/routes` are exempt because their names define the routes.
- Avoid code comments.
- Add a Changeset for consumer-visible changes to public `@nn/*` packages. `example-react` is ignored by Changesets.
- Never run `git commit` or post replies to PR comments unless the user explicitly asks for it.
