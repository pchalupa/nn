# Rebrand to Goodstate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the project from `nn` / `@nn/*` to Goodstate / `@goodstate/*` and bring the README, package pages and DevTools in line with the visual guidelines.

**Architecture:** Two pull requests. PR 1 ("the name", Tasks 1–4) is a mechanical scope rename plus the few hand-edited identifiers, proven by the existing type checks and tests. PR 2 ("the look", Tasks 5–6) corrects the README frames in the brand book, exports the baked brand images from it, then rebuilds the root README around them. Each PR ships on its own.

**Tech Stack:** pnpm workspace, TypeScript, tsdown, Vitest, Changesets, oxfmt/oxlint, cspell, the pen.dev MCP tools for the brand book and image export.

**Spec:** [`docs/design/VISUAL_GUIDELINES.md`](../../design/VISUAL_GUIDELINES.md), with [`docs/design/tokens.css`](../../design/tokens.css) and [`docs/design/diagrams.md`](../../design/diagrams.md).

## Decisions this plan makes

Change any of these before execution starts; every task below assumes them.

| #   | Decision                                                                                                                                                                                                                                       | Why                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | The GitHub repository becomes `pchalupa/goodstate`. Every `pchalupa/nn` URL is rewritten, including SHA permalinks in ADRs.                                                                                                                    | GitHub redirects the old slug, and SHAs stay valid after a rename.                                                                                                                                                     |
| D2  | Versions keep counting. One changeset bumps every public package: `major` for packages at 1.0.0 or above, `minor` for `guards` (0.4.0) and `id` (0.2.0).                                                                                       | Import paths change for every consumer.                                                                                                                                                                                |
| D3  | The default IndexedDB database and BroadcastChannel name changes from `nn-default` to `goodstate-default`.                                                                                                                                     | The major bump is the one moment to do it. The changeset tells consumers to pass `"nn-default"` to keep their data.                                                                                                    |
| D4  | Identifiers that live in deployed infrastructure stay: the Vercel project `nn-example-server` and the Redis keys `nn-example` / `nn-example-preview`.                                                                                          | Renaming them orphans the deployed board's data and needs dashboard work.                                                                                                                                              |
| D5  | `CHANGELOG.md` bodies stay as written. Only the `# @nn/<name>` heading changes.                                                                                                                                                                | They record what shipped under the old name. Changesets finds the file by path, not by heading.                                                                                                                        |
| D6  | The example app gets the name only (title, board name, cookie). Its Radix theme, Phosphor icons and `docs/example/design.pen` stay.                                                                                                            | Section 6 of the guidelines conflicts with `docs/example/design-system.md` on color, icons, corners and cards. That is a redesign, planned below.                                                                      |
| D7  | DevTools keeps its current feature set. It gets the name and token alignment only.                                                                                                                                                             | The replica ID header, engine list and entries table in section 6 need a new `Devtools` API.                                                                                                                           |
| D8  | DevTools does not load IBM Plex Mono. It names the font first in the stack and falls back to `ui-monospace`.                                                                                                                                   | A library that injects a Google Fonts request into its host app makes a network and privacy choice for the app.                                                                                                        |
| D9  | README images are pinned to a repository tag named `brand-v1`. A change to the images gets `brand-v2`.                                                                                                                                         | The guidelines require a tag, and Changesets tags (`@goodstate/store@6.0.0`) contain `@` and `/`, which are awkward in a raw URL.                                                                                      |
| D10 | The banner uses `generated-1.png` (flight controllers) in place of the book's `generated.png`, and the social card uses `generated-6.png` (checklist). `generated.png`, `generated-4.png` and `generated-5.png` never appear in public assets. | See [Photo audit](#photo-audit).                                                                                                                                                                                       |
| D11 | Package READMEs stay plain Markdown with no images. Only the root README carries images.                                                                                                                                                       | The guidelines keep everything but the branded parts as Markdown, and the book only draws the root README.                                                                                                             |
| D12 | The README banner is one Martian Night image in a plain `<img>`, not a `<picture>` with light and dark sources.                                                                                                                                | The book draws the same banner in both README frames, and the two export byte-identical. The guidelines are updated to match in Task 5.                                                                                |
| D13 | The book's footer image does not ship.                                                                                                                                                                                                         | It adds a second tagline to one surface and sets it in the serif reserved for real quotations. Its "MIT © STRV" line is also wrong: Petr Chalupa holds the copyright, as `LICENSE` says, and Task 5 corrects the book. |
| D14 | The README ships two branded images: the banner and the flight plan diagram.                                                                                                                                                                   | Both are in the book, and the cap is three.                                                                                                                                                                            |

## Before execution: things only you can do

1. **pen.dev access.** The pen.dev tools hit the plan's usage limit once while this plan was written and worked again later the same day. Task 5 is the only task that needs them, so run it in one sitting. Nobody should edit a `.pen` file outside those tools.
2. **Rename the GitHub repository** to `goodstate` (Settings → General), then `git remote set-url origin git@github.com:pchalupa/goodstate.git`. Needed before Task 6.
3. **npm.** Confirm you own the `@goodstate` scope. If any `@nn/*` version was ever published, deprecate each after the first `@goodstate` release: `npm deprecate "@nn/<name>" "Renamed to @goodstate/<name>"`. The release workflow only runs `changeset git-tag`, so nothing publishes on its own.
4. **Image license.** Confirm the license of the tool that produced `docs/design/brand-book/generated-*.png` allows public use. Needed before Task 5.

## Global Constraints

- Package names are `@goodstate/<name>`. The product name in prose is "Goodstate". The wordmark is supplied artwork and is never retyped.
- Where the brand book and this plan disagree on a composition, the brand book wins.
- Taglines: "Cleared for offline." is primary, set in Michroma. One tagline per surface.
- Michroma is 400 only and never under 32px. Numbers are Plex Mono with `tabular-nums`.
- One Mars Orange (`#D9621E`) fill per view. Text on orange is Martian Night (`#1C130C`). Orange text under 24px on light backgrounds uses `#A3410E`.
- Corners are square (3px only for inline code and badges). No shadows, blurs or gradients on UI.
- README: three branded images at most, absolute `raw.githubusercontent.com` URLs at a tag, no essential information only in an image, labels in sentence case in Markdown.
- Badges come from shields.io with `labelColor=1C130C&color=FAF0DE`. No orange badges.
- Outside marketing art, status words are `SyncState` values (`connected`, `connecting`, `disconnected`, `idle`, `disposed`).
- Copy never says "nothing is lost" or "never loses data". No exclamation marks. Errors, logs, tool labels and code use the API's names and no metaphors. The existing READMEs and package descriptions were checked against these rules while writing this plan and need no rewording.
- Photos name only real places or describe the subject. No NASA insignia. A generated image is never captioned as a historical photo.
- `AGENTS.md` applies: no type casts, no `any`, `if` over ternaries, kebab-case files, a Changeset for consumer-visible changes, and **no `git commit` unless the user asks for commits in the executing session**. Every "Commit" step below is subject to that.

## Review Focus

1. **A consumer who relied on the default database name upgrades and sees an empty store.** Expected: the changeset says how to keep the data, and an explicit `"nn-default"` still opens the old database. Pinned in Task 3 (the existing "opens a database under the given name" test covers any name; the changeset carries the instruction).
2. **npmjs.com does not resolve relative image paths.** Expected: both README images use absolute URLs and their alt text carries what the image says. Pinned in Task 6, Step 6.
3. **The README lands before the `brand-v1` tag exists and both images 404.** Expected: the tag is pushed first. Pinned in Task 5, Step 8 and Task 6, Step 1.
4. **A stale `@nn/` survives where `sed` did not look: the lockfile, `node_modules/@nn` symlinks, `dist`.** Expected: a clean install and build leave no trace. Pinned in Task 1, Steps 5–7.
5. **Renamed imports and dependency keys are no longer sorted** (`@goodstate/*` now sorts before `@hono/*` and `@phosphor-icons/*`; oxfmt has `sortImports` and `sortPackageJson` on). Expected: `pnpm format:check` passes. Pinned in Task 1, Step 4.

---

## PR 1: the name

### Task 1: Rename the scope and the repository slug

**Files:**

- Modify: every tracked file containing `@nn` or `pchalupa/nn` (191 files, 863 references), except `pnpm-lock.yaml` (regenerated), `*.pen`, and `CHANGELOG.md` bodies
- Modify: `packages/*/CHANGELOG.md` line 1 (14 files)
- Modify: `cspell.json`
- Create: `.changeset/rename-scope-to-goodstate.md`
- Regenerate: `pnpm-lock.yaml`

**Interfaces:**

- Produces: every workspace package is importable as `@goodstate/<name>`; `https://github.com/pchalupa/goodstate` is the only repository URL.

- [ ] **Step 1: Rewrite the scope**

```sh
git grep -lIE '@nn([^a-zA-Z0-9_-]|$)' -- ':!pnpm-lock.yaml' ':!*.pen' ':!**/CHANGELOG.md' ':!docs/notes/plans/rebrand-to-goodstate.md' \
	| xargs sed -i '' -E 's/@nn([^a-zA-Z0-9_-]|$)/@goodstate\1/g'
```

The character class also catches the escaped form `/^@nn\//` in `packages/build-config/src/tsdown.ts` and `packages/test-config/src/vitest/plugins.ts`, and prose such as "for @nn packages".

- [ ] **Step 2: Rewrite the repository slug and the changelog headings**

```sh
git grep -lI 'pchalupa/nn' -- ':!pnpm-lock.yaml' ':!*.pen' ':!docs/notes/plans/rebrand-to-goodstate.md' \
	| xargs sed -i '' -E 's#pchalupa/nn([^a-zA-Z0-9_-]|$)#pchalupa/goodstate\1#g'
for file in packages/*/CHANGELOG.md; do sed -i '' -E '1s|^# @nn/|# @goodstate/|' "$file"; done
```

- [ ] **Step 3: Add `goodstate` to the `words` array in `cspell.json`**

- [ ] **Step 4: Reinstall and re-sort**

Run: `pnpm install && pnpm format:write && pnpm lint:write`
Expected: the lockfile now lists `@goodstate/*` importers, and import blocks and `package.json` dependency keys are re-sorted.

- [ ] **Step 5: Add the changeset `.changeset/rename-scope-to-goodstate.md`**

```md
---
"@goodstate/broadcast-sync": major
"@goodstate/cache": major
"@goodstate/entities": major
"@goodstate/indexdb-sync": major
"@goodstate/observable": major
"@goodstate/react": major
"@goodstate/react-devtools": major
"@goodstate/schema": major
"@goodstate/sse-sync": major
"@goodstate/store": major
"@goodstate/sync-engine": major
"@goodstate/time": major
"@goodstate/guards": minor
"@goodstate/id": minor
---

The package scope is now `@goodstate`. Replace `@nn/` with `@goodstate/` in your dependencies and imports. Nothing else in the API changed.
```

- [ ] **Step 6: Verify nothing references the old scope**

Run: `git grep -nIE '@nn([^a-zA-Z0-9_-]|$)|pchalupa/nn' -- ':!*.pen' ':!**/CHANGELOG.md' ':!docs/notes/plans/rebrand-to-goodstate.md'`
Expected: no output.

Run: `ls node_modules/@nn 2>/dev/null; grep -c '@nn/' pnpm-lock.yaml`
Expected: no directory, and `0`.

- [ ] **Step 7: Verify the workspace**

Run: `pnpm ts:check && pnpm test && pnpm build && pnpm lint:check && pnpm format:check && pnpm clutter:check && pnpm spell:check`
Expected: all pass. `pnpm build` runs publint and attw against the renamed packages.

- [ ] **Step 8: Commit** — `Rename the package scope to @goodstate`

### Task 2: Rename the remaining `nn` identifiers and copy

**Files and exact values:**

| File                                                                                          | From                                                     | To                                                                                                                  |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                                                | `"name": "nn"`, `"description": ""`                      | `"goodstate"`, `"Local-first state management for TypeScript"`                                                      |
| `packages/typescript-config/src/base.json:3`                                                  | `"display": "Nn"`                                        | `"Goodstate"`                                                                                                       |
| `packages/test-config/src/vitest/plugins.ts:20`                                               | `"nn:bundle-for-benchmark"`                              | `"goodstate:bundle-for-benchmark"`                                                                                  |
| `packages/react-devtools/package.json`                                                        | `"Devtools for nn stores"`; homepage without `tree/main` | `"DevTools for Goodstate stores"`; `https://github.com/pchalupa/goodstate/tree/main/packages/react-devtools#readme` |
| `.claude/skills/learning-opportunities/resources/orientation.md:1,7`                          | `nn`                                                     | `Goodstate`                                                                                                         |
| `docs/example/specification.md:12`                                                            | `` `nn` ``                                               | `Goodstate`                                                                                                         |
| `docs/example/design-system.md:274`                                                           | `The nn devtools`                                        | `The Goodstate DevTools`                                                                                            |
| `docs/decisions/ADR-12-report-changes-to-a-single-delegate.md:14`                             | `production use in nn`                                   | `production use in Goodstate`                                                                                       |
| `examples/react/index.html:7`                                                                 | `NN Example`                                             | `Goodstate example`                                                                                                 |
| `examples/react/src/features/board/components/board/index.tsx:43,46`                          | `title="nn"`                                             | `title="Goodstate"`                                                                                                 |
| `examples/react/src/features/board/components/ticket-modal/parts/header.tsx:19`               | `nn`                                                     | `Goodstate`                                                                                                         |
| `examples/react/src/features/board/components/ticket-modal/parts/mobile-ticket-header.tsx:29` | `subtitle="nn"`                                          | `subtitle="Goodstate"`                                                                                              |
| `examples/react/src/features/authentication/session.ts:3`                                     | `"nn-current-user"`                                      | `"goodstate-current-user"`                                                                                          |

**Stays, per D4–D6:** `examples/react/vite.config.ts:9`, `examples/server/api/sync.ts:8`, `examples/server/src/services/database/redis-database.ts:8`, `redis-event-bus.ts:19`, `examples/server/README.md:16`, link labels such as `[nn-store]` in `docs/notes`, and the "nn" text nodes in `docs/example/design.pen`.

- [ ] **Step 1: Update the two tests first**

`examples/react/src/features/board/components/board/index.test.tsx:73-74`: both headings are `"Goodstate"`.
`examples/react/src/features/authentication/session.test.ts:20`: the cookie is `` `goodstate-current-user=${userId}` ``.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter example-react test board/index.test.tsx session.test.ts`
Expected: FAIL, received `"nn"` and `nn-current-user=`.

- [ ] **Step 3: Apply every row of the table**

- [ ] **Step 4: Run the example app's tests**

Run: `pnpm --filter example-react test && pnpm --filter example-react test:e2e`
Expected: PASS. Signing in again once is expected in a browser that holds the old cookie.

- [ ] **Step 5: Verify only the sanctioned leftovers remain**

Run: `git grep -nIwE 'nn|NN|Nn' -- ':!pnpm-lock.yaml' ':!*.pen' ':!**/CHANGELOG.md' ':!docs/notes' ':!docs/thesis' ':!docs/assignment' ':!.agents'`
Expected: `README.md:1` (Task 6), the `nn-default` lines (Task 3), the DevTools labels (Task 4), the five "Stays" lines, and `docs/design/VISUAL_GUIDELINES.md:175` (`FIG. NN`).

- [ ] **Step 6: Commit** — `Rename the remaining nn identifiers to Goodstate`

### Task 3: Rename the default database and channel name

**Files:**

- Modify: `packages/indexdb-sync/src/index-db-sync.ts:15`, `packages/indexdb-sync/src/index-db.ts:15`, `packages/broadcast-sync/src/broadcast-sync.ts:16`
- Modify: `packages/indexdb-sync/README.md:24`, `packages/broadcast-sync/README.md:24`
- Test: `packages/indexdb-sync/src/index-db-sync.test.ts:83`, `packages/broadcast-sync/src/broadcast-sync.test.ts:71`
- Create: `.changeset/rename-default-names.md`

**Interfaces:**

- Produces: `new IndexDbSync(replica, name = "goodstate-default")`, `new IndexDb(name = "goodstate-default")`, `new BroadcastSync(replica, name = "goodstate-default")`.

- [ ] **Step 1: Change the expectations**

`index-db-sync.test.ts` "opens the default database when no name is given": `toContain("goodstate-default")`.
`broadcast-sync.test.ts` "uses the default channel when no name is given": `const second = connect("goodstate-default");`.

- [ ] **Step 2: Run to see them fail**

Run: `pnpm --filter @goodstate/indexdb-sync --filter @goodstate/broadcast-sync test`
Expected: FAIL. The database list holds `nn-default`, and the broadcast test times out in `vi.waitFor`.

- [ ] **Step 3: Change the three defaults and both README sentences to `goodstate-default`**

- [ ] **Step 4: Run to see them pass**

Run: `pnpm --filter @goodstate/indexdb-sync --filter @goodstate/broadcast-sync test`
Expected: PASS, including "opens a database under the given name", which proves an explicit `"nn-default"` still works.

- [ ] **Step 5: Add `.changeset/rename-default-names.md`**

```md
---
"@goodstate/indexdb-sync": major
"@goodstate/broadcast-sync": major
---

The default database and channel name is now `goodstate-default` instead of `nn-default`. If you construct an engine without a name and want to keep reading the data already on the device, pass the old name: `new IndexDbSync(store, "nn-default")` and `new BroadcastSync(store, "nn-default")`.
```

- [ ] **Step 6: Commit** — `Rename the default database and channel to goodstate-default`

### Task 4: Name and align DevTools

**Files:**

- Modify: `packages/react-devtools/src/devtools.tsx`, `src/components/shadow-host.tsx`, `src/components/button.tsx`, `src/tree/tree-node.tsx`, `src/tree/tree-leaf.tsx`
- Modify: `packages/react-devtools/README.md`
- Test: `packages/react-devtools/src/devtools.test.tsx`, `src/index.test.tsx`
- Create: `.changeset/devtools-goodstate-labels.md`

**Interfaces:**

- Produces: host element `<div data-goodstate-devtools>`; accessible names `Goodstate DevTools` (panel) and `Open Goodstate DevTools` (button). Custom properties that also exist in `docs/design/tokens.css` carry the same name and value.

- [ ] **Step 1: Update the tests**

In `devtools.test.tsx` and `index.test.tsx`, every `[data-nn-devtools]` becomes `[data-goodstate-devtools]`, every `"Open nn devtools"` becomes `"Open Goodstate DevTools"`, and `{ name: "nn devtools" }` becomes `{ name: "Goodstate DevTools" }`.

- [ ] **Step 2: Run to see them fail**

Run: `pnpm --filter @goodstate/react-devtools test`
Expected: FAIL with "Devtools are not rendered".

- [ ] **Step 3: Rename the labels and the host attribute**

`devtools.tsx`: `label="Goodstate DevTools"` on `Drawer`, `label="Open Goodstate DevTools"` on `Button`. `shadow-host.tsx`: `data-goodstate-devtools=""`.

- [ ] **Step 4: Align the custom properties with `tokens.css`**

| In DevTools today                             | Becomes                                                                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `--gs-syntax-text`                            | `--gs-syntax-default` (definition in `devtools.tsx`, two uses in `tree-node.tsx`)                                            |
| `--gs-duration-fast`                          | `--gs-duration` (definition, reduced-motion rule, uses in `button.tsx` and `tree-node.tsx`)                                  |
| numbers and bigints use `--gs-syntax-keyword` | add `--gs-syntax-number: #c7744a` and use it for `number` and `bigint` in `tree-leaf.tsx`; `boolean` keeps the keyword color |

The font stack stays as it is (D8).

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @goodstate/react-devtools test && pnpm --filter @goodstate/react-devtools ts:check`
Expected: PASS.

- [ ] **Step 6: Check it in the example app**

Run: `pnpm --filter example-react --filter example-server dev`, open http://localhost:3000, open DevTools.
Expected: the button reads "DEVTOOLS", the panel opens, and a number value renders in Rust (`#C7744A`), not orange.

- [ ] **Step 7: Write `packages/react-devtools/README.md` from `docs/templates/package-readme.md`**

Description: "DevTools for Goodstate stores." Installation: `npm install @goodstate/react-devtools`. Usage: import `Devtools` from `@goodstate/react-devtools` and render `<Devtools store={store} />` next to the app root, followed by one sentence: "The panel renders only in development or under browser automation."

- [ ] **Step 8: Add `.changeset/devtools-goodstate-labels.md`**

```md
---
"@goodstate/react-devtools": patch
---

The panel is labelled "Goodstate DevTools" and its host element carries `data-goodstate-devtools` instead of `data-nn-devtools`. Numbers now have their own syntax color.
```

- [ ] **Step 9: Run the PR 1 gate**

Run: `pnpm ts:check && pnpm test && pnpm lint:check && pnpm format:check && pnpm clutter:check && pnpm spell:check && pnpm --filter example-react test:e2e`
Expected: all pass.

- [ ] **Step 10: Commit** — `Label DevTools as Goodstate and align its tokens`

---

## PR 2: the look

### What the brand book holds

Read through the pen.dev tools on 2026-11-27. `docs/design/brand-book/brand-book.pen` has three top-level frames: `Goodstate Mood Board`, `Goodstate README` and `Goodstate README Dark`. There is no frame named _Goodstate Visual Identity Guidelines_, which is the name the guidelines cite.

| In the book                                                                                                             | What this plan does with it                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| The wordmark is live Michroma text (`NVEvR`, 168px, Martian Night). An SVG export turns it into one outlined path.      | That export is the supplied artwork.                                                                                          |
| `Mission Patch` (`bzXiT`) is vector shapes and exports to SVG with no text nodes.                                       | Exported as is.                                                                                                               |
| `Banner Image`, 836 × 400, in both README frames (`b3yusV`, `NaBKH`). The two export byte-identical at 1672 × 800.      | One banner file serves both themes (D12).                                                                                     |
| The banner photo is `generated.png`.                                                                                    | Replaced. See [Photo audit](#photo-audit).                                                                                    |
| The banner tagline is "State that survives the dark side." in Plex Serif 26.                                            | Becomes "Cleared for offline." in Michroma 32, as section 4 of the guidelines says. Serif is for quotations from real people. |
| The banner tint is `#D0641F8C`.                                                                                         | Becomes `#D9621E8C`, the value of `--gs-image-tint`.                                                                          |
| `Diagram Image`, "FIG. 02 — FLIGHT PLAN" (`lzwZ1`, `ohZUh`), byte-identical in both frames at 1672 × 934. Lucide icons. | Shipped as the second README image, after one copy fix: "Nothing is lost when power cycles." is removed.                      |
| `Footer Image` (`RtTTM`, `EgPgx`): "Good state, godspeed." in Plex Serif, and "MIT © STRV".                             | Not shipped (D13). The copyright line is corrected in the book.                                                               |
| The README mockup's quick start uses `useRead` / `useUpdate`, metaphor comments in code, and `apps/…` paths.            | The real README keeps `useQuery` / `useMutation`, no metaphors in code, and `examples/…`.                                     |
| Five badges: npm, license, types, gzip, build.                                                                          | License now, npm after the first publish. The gzip figure is not measured anywhere.                                           |
| No social card frame.                                                                                                   | Built in the book in Task 5.                                                                                                  |

### Photo audit

Checked against section 5 of the guidelines. All seven files are JPEG data with a `.png` extension.

| File              | Subject                        | Verdict                                                                                                                             |
| ----------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `generated-1.png` | Flight controllers at consoles | Use for the README banner. People at work, consoles.                                                                                |
| `generated-6.png` | Checklist binder under a lamp  | Use for the social card. Warm tungsten, checklist.                                                                                  |
| `generated-3.png` | Suit hardware close-up         | Usable later.                                                                                                                       |
| `generated-2.png` | Launch at sunset               | Hold back. Spectacle over competence; fits a launch moment at most.                                                                 |
| `generated.png`   | Astronaut by a lunar habitat   | Never public, and it is the book's current banner photo. "JAMESTOWN BASE" is lettered on the habitat, and the suit carries patches. |
| `generated-5.png` | Mars base                      | Never public. This is the book's "Happy Valley" scene from _For All Mankind_.                                                       |
| `generated-4.png` | Earth through a window         | Never public. Cold blue, and the subject is outer space.                                                                            |

### Task 5: Correct the brand book and export the assets

Blocked until the image license is confirmed. Every step that touches the `.pen` file goes through the pen.dev MCP tools (`execute` with `Update`, `Copy`, `Export`, `TakeScreenshot`); never edit the file on disk.

**Files:**

- Modify: `docs/design/brand-book/brand-book.pen` (both README frames, plus one new frame)
- Modify: `docs/design/VISUAL_GUIDELINES.md` (lines 7, 139 and 147)
- Create: `docs/design/assets/wordmark-positive.svg`, `wordmark-negative.svg`, `mission-patch.svg`
- Create: `docs/design/assets/readme-banner.png` (1672 × 800), `readme-flight-plan.png` (1672 × 934), `social-preview.png` (1280 × 640)

**Interfaces:**

- Produces: `readme-banner.png` and `readme-flight-plan.png` at tag `brand-v1`, which Task 6 links to.

- [ ] **Step 1: Correct the banner in both README frames**

Apply to `b3yusV` and to `NaBKH`. Child ids below are from `b3yusV`; find the same names inside `NaBKH`.

| Node                    | Today                                                   | Becomes                                    |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------ |
| `Banner Image` fill     | image `generated.png`, color `#D0641F8C`                | image `generated-1.png`, color `#D9621E8C` |
| `Mission Label` `lpYXv` | `MISSION 001  ·  LOCAL-FIRST STATE FOR TYPESCRIPT`      | `LOCAL-FIRST STATE FOR TYPESCRIPT`         |
| `Tagline` `MSbmi`       | "State that survives the dark side.", IBM Plex Serif 26 | "Cleared for offline.", Michroma 32        |
| `Fig Label` `GdDHn`     | `FIG. 01`                                               | `FIG. 01 — FLIGHT CONTROLLERS AT CONSOLES` |

The `Telemetry` readout and `● GO FOR LAUNCH` stay: the guidelines allow readouts in marketing art that is plainly not a real screen.

- [ ] **Step 2: Correct the diagram and the footer in both README frames**

In `lzwZ1` and `ohZUh`, the `Flight recorder` description becomes "Persists the store on the device." In `RtTTM` and `EgPgx`, "MIT © STRV" becomes "MIT © Petr Chalupa".

- [ ] **Step 3: Build the social card frame**

A new top-level frame `Goodstate Social Card`, 1280 × 640, `clip: true`, placed with `FindEmptySpace`. Copy the fill stack of `b3yusV` and swap the image for `generated-6.png`. 64px safe margin. Contents: a mono label row top-left (`LOCAL-FIRST STATE FOR TYPESCRIPT`) with `● GO FOR LAUNCH` top-right; the wordmark in Sunlight; "State that survives the dark side." in IBM Plex Sans 500; the install line `$ npm i @goodstate/react` in IBM Plex Mono 24, Bronze `#B48A55`; the caption `FIG. 02 — LAUNCH CHECKLIST` bottom-left, 20px in, on `#1C130CCC`.

- [ ] **Step 4: Check the three frames**

`TakeScreenshot` of `b3yusV`, `lzwZ1` and the social card. Each must hold: no text is clipped (`Get` with a visitor reports no `problems`), Sunlight text reaches 4.5:1 against the lightest area behind it, the caption is present, the diagram keeps its single Mars Orange fill, and neither banner nor card adds one.

- [ ] **Step 5: Export**

Export to a scratch directory, then copy under the final names. Files come out as `<nodeId>.<ext>`.

| Export call                                        | Becomes `docs/design/assets/…`                |
| -------------------------------------------------- | --------------------------------------------- |
| `Export(["NVEvR"], "svg", dir)`                    | `wordmark-positive.svg`                       |
| `Export(["Bzaq5"], "svg", dir)`                    | `wordmark-negative.svg`                       |
| `Export(["bzXiT"], "svg", dir)`                    | `mission-patch.svg`                           |
| `Export(["b3yusV", "lzwZ1"], "png", dir)`          | `readme-banner.png`, `readme-flight-plan.png` |
| `Export([socialCardId], "png", dir, { scale: 1 })` | `social-preview.png`                          |

Run: `file docs/design/assets/*.png && grep -c '<text' docs/design/assets/*.svg`
Expected: `1672 x 800`, `1672 x 934`, `1280 x 640`, and `0` for every SVG.

Run the same two exports for `NaBKH` and `ohZUh` and `cmp` them against the light ones.
Expected: identical. If they differ, the frames drifted in Step 1 or 2.

- [ ] **Step 6: Bring the guidelines in line with the book**

`VISUAL_GUIDELINES.md:7`: name the three real frames in place of "the _Goodstate Visual Identity Guidelines_ frame". `VISUAL_GUIDELINES.md:139`: the banner is one image for both themes, an `<img>` and not a `<picture>`; the rest of the sentence stands. `VISUAL_GUIDELINES.md:147`: drop the `<picture>` clause and "The light image has to work alone."

- [ ] **Step 7: Show the three images to the user and wait for approval**

- [ ] **Step 8: Commit, merge, then tag**

Commit — `Add Goodstate brand assets`. After the commit is on `main`, and only with the user's go-ahead: `git tag brand-v1 <merge commit> && git push origin brand-v1`. The user uploads `social-preview.png` under Settings → Social preview.

### Task 6: Rebuild the root README

**Files:**

- Modify: `README.md`

**Interfaces:**

- Consumes: `https://raw.githubusercontent.com/pchalupa/goodstate/brand-v1/docs/design/assets/readme-banner.png` and `…/readme-flight-plan.png` from Task 5.

The section order follows the `Goodstate README` frame: banner, badges, intro, quick start with a note, how it works with the diagram, packages, examples.

- [ ] **Step 1: Confirm the tag exists**

Run: `git ls-remote --tags origin brand-v1`
Expected: one line. Stop here if it is empty.

- [ ] **Step 2: Replace the `# nn` heading with the banner, heading and badge**

```md
<img alt="Goodstate. Cleared for offline. Local-first state for TypeScript." src="https://raw.githubusercontent.com/pchalupa/goodstate/brand-v1/docs/design/assets/readme-banner.png" width="836" />

# Goodstate

[![License: MIT](https://img.shields.io/github/license/pchalupa/goodstate?labelColor=1C130C&color=FAF0DE)](LICENSE)
```

Add `[![npm](https://img.shields.io/npm/v/@goodstate/store?labelColor=1C130C&color=FAF0DE)](https://www.npmjs.com/package/@goodstate/store)` only once `@goodstate/store` is published. The intro paragraph and the quick start code stay as Task 1 left them. The banner already carries the tagline, so the body adds none.

- [ ] **Step 3: Turn the last sentence of the quick start into a native callout**

The closing paragraph keeps "`IndexDbSync` saves the state on the device and `SseSync` syncs it with a server. Use either one or both." The third sentence moves into:

```md
> [!NOTE]
> Engines start idle, so you can add listeners before calling `connect()`.
```

- [ ] **Step 4: Add `## How it works` after the quick start**

```md
## How it works

The store carries all state on board, like a spacecraft that keeps flying without the ground. Sync engines open links to the outside and merge whatever comes back.

<img alt="Flight plan. IndexedDB sync, broadcast sync and SSE sync connect to the store, which merges concurrent changes without conflicts." src="https://raw.githubusercontent.com/pchalupa/goodstate/brand-v1/docs/design/assets/readme-flight-plan.png" width="836" />
```

- [ ] **Step 5: Add `## Packages` between it and the examples**

A two-column table, `Package` and `Description`, as in the book. Each name links to its folder and each description is that package's `description` from `package.json`, so the two cannot drift. All fourteen public packages, in this order: `store`, `schema`, `react`, `indexdb-sync`, `broadcast-sync`, `sse-sync`, `entities`, `time`, `sync-engine`, `react-devtools`, `observable`, `cache`, `guards`, `id`.

- [ ] **Step 6: Verify the README survives npm and GitHub**

Run: `grep -nE '\.(png|jpg|svg)' README.md | grep -v 'https://'`
Expected: no output (every image path is absolute).

Run: `grep -c 'raw.githubusercontent.com/pchalupa/goodstate/brand-v1/' README.md`
Expected: `2`.

Run: `pnpm format:check && pnpm spell:check`
Expected: PASS.

Push the branch and view the README on GitHub in light and dark mode. Expected: both images load at 836px wide and read on either background.

- [ ] **Step 7: Commit** — `Rebuild the README around the Goodstate banner`

---

## Follow-up plans

Each of these is its own design and plan. None blocks the two PRs above.

1. **Example app reskin.** Section 6 of the guidelines covers example apps, and `examples/react` breaks it by design: stock Radix dark with a violet accent, rounded corners, a board of cards, Phosphor icons, and a 💫 favicon. It needs a redesign in `docs/example/design.pen` first (pen.dev access), then a rewrite of `docs/example/design-system.md`, then the code. The "nn" text nodes in `design.pen` change in the same pass.
2. **DevTools build-out.** The replica ID header, tabs, the engine list with status chips and "Retry", and the entries table with entity kind and hybrid logical clock timestamp. `Devtools` takes only `store: Inspectable` today, so this starts with an API decision and an ADR.
3. **Terminal output.** `examples/node`, `examples/server` and `examples/agent` log through `pino-pretty` defaults. The guidelines ask for the panel palette and a leading status glyph.
4. **Release posts.** The title form "v1.4.0 — headline" and the mono label line apply when the first GitHub release is written. The workflow only tags today. Stickers and talk slides wait for a concrete occasion.
