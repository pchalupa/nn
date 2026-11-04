# Example app design system

How to build UI in `apps/example-react` so it matches `docs/example/design.pen`. The `.pen` file is the source of truth. This document turns it into Tailwind v4 classes, so you can build without opening the file.

`design.pen` is encrypted. Read it only through the `pencil` MCP tools (`get_app_state`, then `execute` with `Get`, `GetVariables` and `TakeScreenshot`), never with `Read` or `grep`. Open it when you need a value this document leaves out, or to check a screen visually. When this document and the file disagree, the file wins; update this document.

## Principles

- **Dark only.** No light theme, no `dark:` variants.
- **Flat.** Solid surfaces, one 1px border weight, no gradients. The only shadow is `shadow-overlay`.
- **Semantic tokens.** Write `bg-card`, `text-fg-muted`, `border-line`. Palette classes like `bg-zinc-900` or `text-gray-900` stay out of components. Existing components still use palette classes; move them to tokens when you touch them.
- **Tailwind defaults.** Type, weight, radius and spacing use Tailwind's stock scales. Spacing is 4px per step; stick to whole and half steps (`p-3`, `gap-1.5`).
- **Cheap to rebuild.** A mobile and a Next.js app will copy every screen, so keep compositions simple and reuse the components below.
- **Sync is the demo.** Offline state, pending changes, merges and remote edits are always visible in the UI, never hidden in dev tools.

## Theme

Put this in `apps/example-react/src/main.css`, after `@import "tailwindcss";`. It adds only colors, fonts and one shadow.

```css
@theme inline {
	--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
	--font-mono: "JetBrains Mono", ui-monospace, monospace;

	--color-canvas: var(--color-zinc-950);
	--color-panel: #111113;
	--color-card: var(--color-zinc-900);
	--color-card-hover: #1f1f23;
	--color-field: #141416;
	--color-overlay: #1c1c20;
	--color-selected: rgb(255 255 255 / 6%);

	--color-line-subtle: #222226;
	--color-line: var(--color-zinc-800);
	--color-line-strong: var(--color-zinc-700);

	--color-fg: var(--color-zinc-100);
	--color-fg-muted: var(--color-zinc-400);
	--color-fg-subtle: var(--color-zinc-500);
	--color-fg-inverse: var(--color-zinc-950);

	--color-accent: var(--color-violet-400);
	--color-accent-fg: var(--color-violet-300);
	--color-accent-soft: color-mix(in oklab, var(--color-violet-500) 15%, transparent);

	--color-status-todo: var(--color-zinc-400);
	--color-status-progress: var(--color-blue-400);
	--color-status-done: var(--color-green-400);

	--color-success: var(--color-green-400);
	--color-success-soft: color-mix(in oklab, var(--color-green-400) 12%, transparent);
	--color-warning: var(--color-amber-400);
	--color-warning-soft: color-mix(in oklab, var(--color-amber-400) 12%, transparent);
	--color-danger: var(--color-red-400);
	--color-danger-soft: color-mix(in oklab, var(--color-red-400) 12%, transparent);
	--color-info: var(--color-blue-400);
	--color-info-soft: color-mix(in oklab, var(--color-blue-400) 12%, transparent);

	--color-label-violet: var(--color-violet-300);
	--color-label-violet-soft: color-mix(in oklab, var(--color-violet-500) 20%, transparent);
	--color-label-orange: var(--color-orange-300);
	--color-label-orange-soft: color-mix(in oklab, var(--color-orange-500) 20%, transparent);
	--color-label-cyan: var(--color-cyan-300);
	--color-label-cyan-soft: color-mix(in oklab, var(--color-cyan-500) 20%, transparent);
	--color-label-green: var(--color-green-300);
	--color-label-green-soft: color-mix(in oklab, var(--color-green-500) 20%, transparent);
	--color-label-red: var(--color-red-300);
	--color-label-red-soft: color-mix(in oklab, var(--color-red-500) 20%, transparent);
	--color-label-pink: var(--color-pink-300);
	--color-label-pink-soft: color-mix(in oklab, var(--color-pink-500) 20%, transparent);
	--color-label-gray: var(--color-zinc-300);
	--color-label-gray-soft: rgb(255 255 255 / 8%);

	--shadow-overlay: 0 16px 40px rgb(0 0 0 / 50%);
}
```

## Color roles

Each token works with `bg-*`, `text-*` and `border-*`, and takes `/opacity` modifiers.

| Role       | Tokens                                  | Use                                                                                 |
| ---------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| Surfaces   | `canvas`                                | Page background.                                                                    |
|            | `panel`                                 | Sidebar, board header, columns, sign-in card.                                       |
|            | `card`, `card-hover`                    | Ticket cards, link rows, filter chips, secondary buttons. `card-hover` on hover and drag. |
|            | `field`                                 | Inputs and textareas, one step darker than cards.                                   |
|            | `overlay`                               | Menus, toasts, dialogs, the ticket modal.                                           |
|            | `selected`                              | Active nav item, highlighted menu item.                                             |
| Lines      | `line-subtle`                           | Card and panel borders, section dividers.                                           |
|            | `line`                                  | Control borders: inputs, buttons, chips, menus.                                     |
|            | `line-strong`                           | Emphasis: dragged card, unassigned avatar ring.                                     |
| Text       | `fg`                                    | Primary text.                                                                       |
|            | `fg-muted`                              | Body copy, secondary text, default icons.                                           |
|            | `fg-subtle`                             | Meta, counts, placeholders, captions, keys.                                         |
|            | `fg-inverse`                            | Text on `bg-fg` and `bg-accent`.                                                    |
| Accent     | `accent`, `accent-fg`, `accent-soft`    | Focus borders, brand mark, agent avatar; `accent-fg` for links and merge notes; `accent-soft` for drop targets. |
| Status     | `status-todo`, `-progress`, `-done`     | Status icons only. Column chrome stays neutral.                                     |
| Feedback   | `success`, `warning`, `danger`, `info`, each with `-soft` | Sync state, toasts, destructive actions. Pair the hue as text or dot on its `-soft` background. |
| Labels     | `label-{violet,orange,cyan,green,red,pink,gray}`, each with `-soft` | Labels and person avatars. Always pair them: `bg-label-red-soft text-label-red`. |

For a one-off tint, use an opacity modifier (`bg-accent/10`) instead of a new token.

## Typography

Inter is `font-sans` (the default), JetBrains Mono is `font-mono`. Each `text-*` size carries its own line height.

| Style      | Classes                                         | Use                                         |
| ---------- | ----------------------------------------------- | ------------------------------------------- |
| Display    | `text-2xl font-semibold tracking-tight`         | Page titles.                                |
| Title      | `text-lg font-semibold`                         | Card and dialog titles, modal ticket title. |
| Heading    | `text-sm font-semibold`                         | Section headings, wordmark.                 |
| Card title | `text-sm font-medium`                           | Ticket titles, button labels, names.        |
| Body       | `text-sm/normal text-fg-muted`                  | Descriptions, comments, helper paragraphs.  |
| Small      | `text-xs text-fg-muted`                         | Assignee names, toast text, hints.          |
| Caption    | `text-xs font-medium uppercase tracking-wider text-fg-subtle` | Field labels in the modal, sidebar section titles. |
| Mono       | `font-mono text-xs text-fg-subtle`              | Ticket keys (`#142`), counts, timestamps, commit hashes, keyboard shortcuts. |

## Shape and icons

Radius: `rounded-sm` (4px) for labels, kbd and menu items; `rounded-md` (6px) for buttons, inputs, chips and nav items; `rounded-lg` (8px) for cards, menus and toasts; `rounded-xl` (12px) for columns, dialogs, the modal and the sign-in card; `rounded-full` for avatars, sync status and presence.

Icons are [Phosphor](https://phosphoricons.com), regular weight. Sizes: `size-3` in card footers and labels, `size-3.5` in buttons, inputs and status, `size-4` in nav items, icon buttons and toasts. Icons default to `text-fg-muted`, or `text-fg-subtle` when decorative. Names used in the design:

| Meaning                              | Icon                                                  |
| ------------------------------------ | ----------------------------------------------------- |
| Status to do / in progress / done    | `circle-dashed` / `radio-button` / `check-circle`     |
| Board, brand mark                    | `kanban`                                              |
| New, add                             | `plus`                                                |
| More, close, search                  | `dots-three`, `x`, `magnifying-glass`                 |
| Comments, links, PR, merge           | `chat-circle`, `link`, `git-pull-request`, `git-merge` |
| Agent, person, unassigned            | `robot`, `user`, `user` on an outlined circle         |
| Synced, other device, other tab      | `cloud-check`, `desktop`, `app-window`                |
| Inbox, sort, check, expand           | `tray`, `arrows-down-up`, `check`, `caret-right`, `caret-down` |

## Components

Each entry names the `.pen` component, then the classes that reproduce it. Hover and focus states follow the same pattern everywhere: hover lifts to the next surface (`hover:bg-card-hover` on cards, `hover:bg-selected` on ghost controls), and focus sets `border-accent` on fields and an `outline-accent` ring on buttons.

### Buttons

All buttons: `inline-flex h-7.5 items-center gap-1.5 rounded-md px-3 text-sm font-medium`, icon `size-3.5`. Use one primary button per view.

| Variant        | Classes                                         |
| -------------- | ----------------------------------------------- |
| `Button/Primary`   | `bg-fg text-fg-inverse`. With a trailing shortcut: `pr-1.5`, the kbd on `bg-fg-inverse/10`. |
| `Button/Secondary` | `border border-line bg-card text-fg`        |
| `Button/Ghost`     | `text-fg-muted hover:bg-selected`. Compact form (`h-6.5 px-2`) for "Add filter", toast actions and "Copy link". |
| `Button/Danger`    | `bg-danger-soft text-danger`                |
| `IconButton`       | `inline-flex size-7 items-center justify-center rounded-md text-fg-muted hover:bg-selected`, icon `size-4`. Shrinks to `size-6` in column headers and `size-4.5` inside filter chips. |
| `Kbd`              | `rounded-sm border border-line bg-selected px-1 py-px font-mono text-xs text-fg-muted` |

Full-width form buttons (sign-in) are `h-9 w-full justify-center`.

### Inputs

| Component   | Classes                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| `Input`     | `flex h-8 items-center gap-2 rounded-md border border-line bg-field px-2.5 text-sm text-fg placeholder:text-fg-subtle focus-within:border-accent`. Optional leading icon `size-3.5 text-fg-subtle` and trailing `Kbd`. |
| `Field`     | `flex flex-col gap-1.5`: label `text-xs font-medium text-fg-muted`, an `Input`, hint `text-xs text-fg-subtle`. |
| `Textarea`  | `rounded-md border border-line bg-field px-2.5 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-accent` |
| Segmented   | Status picker in the edit modal: `flex h-8 gap-0.5 rounded-md border border-line bg-field p-0.5`, active segment `bg-selected`. |

### Labels, tags and status

- **`Label`**: `inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-xs font-medium` plus a hue pair, e.g. `bg-label-red-soft text-label-red`. Leading dot `size-1.5 rounded-full bg-current`. In edit mode, a trailing `x` icon (`size-3`) removes it. Labels are free-form; hash the label name to pick one of the seven hues so the same name always gets the same color.
- **`Tag`**: outlined action chip, `inline-flex h-5 items-center gap-1 rounded-sm border border-line px-1.5 text-xs text-fg-muted`, leading `plus` icon. Used for "Add label" and label suggestions.
- **`Status`**: `inline-flex items-center gap-1.5 text-sm font-medium text-fg`, status icon `size-3.5` in its `text-status-*` color. The icon carries the color, the text stays `text-fg`.

### Avatars

| Component            | Classes                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `Avatar`             | `flex size-5 items-center justify-center rounded-full text-[10px] font-semibold` plus a label hue pair picked by name, e.g. `bg-label-violet-soft text-label-violet`. Shows initials. |
| `Avatar/Agent`       | `flex size-5 items-center justify-center rounded-sm bg-accent text-fg-inverse`, `robot` icon `size-3`. Agents are always square so their changes read differently from people's. |
| `Avatar/Unassigned`  | `flex size-5 items-center justify-center rounded-full border border-line-strong text-fg-subtle`, `user` icon `size-3`. |
| `Assignee`           | `inline-flex items-center gap-1.5`: avatar plus name in `text-xs text-fg-muted`.                         |

Larger sizes: `size-6` in comments, `size-7` in the sidebar account and account menu, `size-8` standalone (agent avatar becomes `rounded-md`).

### Board

- **`Column`**: `flex w-80 flex-col gap-2 rounded-xl border border-line-subtle bg-panel p-2`. On the board, columns share the width (`flex-1`) and fill the height.
- **`Column Header`**: `flex h-8 items-center gap-2 pr-1 pl-2`: `Status`, count in `font-mono text-xs text-fg-subtle`, spacer, then `plus` and `dots-three` icon buttons (`size-6`).
- **`Ticket Card`**: `flex flex-col gap-2.5 rounded-lg border border-line-subtle bg-card p-3`.
  - Top row `flex gap-2`: title `text-sm font-medium text-fg`, key `font-mono text-xs text-fg-subtle`.
  - Labels row `flex flex-wrap gap-1.5`.
  - Footer `flex items-center gap-3 text-xs text-fg-subtle`: comment count (`chat-circle`) and link count (`link`), icons `size-3`, then `Assignee` pushed right.
  - Sync note, only right after a remote change: `flex items-center gap-1.5 border-t border-line-subtle pt-2 text-xs text-accent-fg` with a `git-merge` icon, e.g. "Merged from MacBook · just now".
- **Card states**:

  | State                       | Change from default                                         |
  | --------------------------- | ----------------------------------------------------------- |
  | Hover                       | `bg-card-hover border-line`                                 |
  | Synced from another device  | `border-accent`, plus the sync note                         |
  | Dragging                    | `bg-card-hover border-line-strong shadow-overlay`           |
  | Drop target (`Drop Placeholder`) | Empty `h-18 rounded-lg border border-accent bg-accent-soft` in the slot |

- **`Add Ticket`**: `flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-fg-subtle`, `plus` icon, text "New ticket". Sits at the bottom of each column.

### Navigation and sync

- **`Nav Item`**: `flex h-7.5 items-center gap-2.5 rounded-md px-2 text-sm text-fg-muted hover:bg-selected`: icon `size-4`, label, trailing count in `font-mono text-xs text-fg-subtle`. Active item adds `bg-selected`. Label filters in the sidebar use a label-colored dot in place of the icon.
- **`Nav Section`**: `px-2 pt-4 pb-1.5` with a Caption-style title, e.g. "LABELS".
- **`Sync Status`**: pill `inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs`, dot `size-1.5 rounded-full`, state text `font-medium`, optional detail in `text-fg-subtle`.

  | State    | Background          | Dot and text    | Detail example            |
  | -------- | ------------------- | --------------- | ------------------------- |
  | Synced   | `bg-success-soft`   | `success`       | none                      |
  | Syncing  | `bg-info-soft`      | `info`          | "3 → server"              |
  | Offline  | `bg-warning-soft`   | `warning`       | "3 changes saved locally" |

- **`Presence`**: `inline-flex h-6 items-center gap-2 rounded-full border border-line px-2 text-xs text-fg-muted`, `desktop` icon `size-3.5`, text like "2 tabs · 3 devices".
- **`Filter Chip`**: `inline-flex h-6.5 items-center gap-1.5 rounded-md border border-line bg-card pr-1 pl-2 text-xs`: icon `text-fg-subtle`, key `text-fg-subtle`, value `font-medium text-fg`, clear `IconButton` `size-4.5`.

### Ticket detail

- **`Property`**: `flex h-8 items-center gap-3`: key `text-sm text-fg-subtle`, value is a component (`Status`, `Assignee`, labels).
- **`Link Row`**: `flex h-9 items-center gap-2.5 rounded-md border border-line-subtle bg-card px-2.5`: icon `size-3.5` (a merged PR uses `git-pull-request` in `text-status-done`), title `text-sm text-fg`, meta `font-mono text-xs text-fg-subtle` such as `#212` or a short hash.
- **`Comment`**: `flex gap-2.5`: `Avatar` `size-6`, then `flex flex-col gap-1` with a head (author `text-sm font-medium text-fg`, time `font-mono text-xs text-fg-subtle`) and the body in `text-sm text-fg-muted`. Agent comments use `Avatar/Agent`.
- **`Remote Cursor`**: another user typing in the description. A 2×18px caret plus a flag `rounded-sm rounded-tl-none px-1 py-px text-[10px] font-semibold text-fg-inverse` with "Name · Device". Both use the user's label hue at full strength (`bg-label-orange`).

### Overlays and feedback

All overlays: `rounded-lg border border-line bg-overlay shadow-overlay` (dialogs use `rounded-xl`).

- **`Menu`**: `w-60 flex flex-col gap-0.5 p-1`. Optional search row on top (`h-8 gap-2 px-2 border-b border-line-subtle`).
- **`Menu Item`**: `flex h-7.5 items-center gap-2 rounded-sm px-2 text-sm text-fg`: optional leading avatar or icon, label, meta `text-xs text-fg-subtle`, trailing `check` when selected. Highlighted item gets `bg-selected`.
- **`Toast`**: `flex items-center gap-2.5 py-2.5 pr-2.5 pl-3`: icon `size-4` in a feedback color (`cloud-check` success, `app-window` info), body with title `text-sm font-medium text-fg` and text `text-xs text-fg-muted`, optional compact ghost action. Sits bottom right, 340px wide.
- **`Dialog`**: `w-100 rounded-xl`. Body `flex flex-col gap-2 p-5` with title `text-base font-semibold text-fg` and text `text-sm text-fg-muted`. Actions `flex justify-end gap-2 border-t border-line-subtle bg-white/2 px-5 py-3`: `Button/Secondary` cancel, then the confirming button (`Button/Danger` for deletes).
- **`Account Menu`**: a `Menu` whose top row shows the user (`Avatar` `size-7`, name `text-sm font-medium`, meta "Passkey · this MacBook" `text-xs text-fg-subtle`) above a `border-b border-line-subtle`, then "Switch user" and "Sign out" items.

## Screens

All screens are 1440×900 frames on `bg-canvas`.

### Sign in and sign up

Centered stack, `gap-6`: brand (24px `bg-accent rounded-md` mark with `kanban` icon, wordmark "Board" in Heading style), then the **`Sign-in Card`**: `w-90 flex flex-col gap-5 rounded-xl border border-line-subtle bg-panel p-6`. It holds a 32px accent mark, a Title, a Body line, a name `Field` (sign up only), a full-width primary passkey button and a centered switch line (`text-xs text-fg-subtle` plus a `text-accent-fg font-medium` link). Accounts are passkey only.

### Board

- **Sidebar**: `w-60 flex flex-col gap-0.5 border-r border-line-subtle bg-panel px-2 py-3`. Brand row, nav items (Board, Assigned to me, Agents), a "LABELS" section with one nav item per label, a spacer, then the account row (`border-t border-line-subtle`, avatar, name and meta, `caret-down`) that opens the `Account Menu`.
- **`Board Header`**: `flex h-13 items-center gap-3 border-b border-line-subtle bg-panel px-4`. Left to right: `kanban` icon, board name (Heading), ticket count (`text-xs text-fg-subtle`, e.g. "24 tickets"), a 1×16px `bg-line` divider, filter chips plus "Add filter", a spacer, `Presence`, `Sync Status`, and the primary "New ticket" button with its `N` shortcut.
- **Columns**: `flex flex-1 gap-4 p-4`, three equal `Column`s: To do, In progress, Done.

### Ticket modal

Opening a ticket overlays the board with a scrim (`bg-canvas/70`) and centers a `w-230 rounded-xl border border-line bg-overlay` modal.

- **Header** `flex h-13 items-center gap-2 border-b border-line-subtle pr-3 pl-5`: breadcrumb (`kanban` icon, board name `text-sm font-medium text-fg-muted`, `caret-right`, key in mono), spacer, then compact ghost "Copy link" and a close `IconButton`. In edit mode, "Copy link" is replaced by an "Unsaved changes" marker (warning dot plus `text-xs text-fg-muted`).
- **Body** is two columns, 640px tall:
  - Content `flex-1 flex flex-col gap-6 p-6`. View mode: ticket title (Title style), description, then comments with a comment input. Edit mode: Caption-labelled title input and a description editor that fills the height (focused with `border-accent`); comments collapse to a "COMMENTS · 3" row marked "Read-only while editing".
  - Details `w-90 flex flex-col gap-5 border-l border-line-subtle p-6`: Status, Assignee, Labels and Links. View mode lists them as `Property` rows; edit mode turns each into a Caption-labelled control (status segmented control, assignee select, labels input with `Tag` suggestions, link rows plus an add-link `Input`).
- **Footer** `flex items-center gap-2 border-t border-line-subtle bg-white/2 px-5 py-3`: `Button/Danger` "Delete" on the left; on the right, `Button/Secondary` "Close" in view mode, or "Cancel" plus `Button/Primary` "Save" in edit mode.
