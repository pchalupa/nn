# Example app design system

How to build UI in `examples/react` so it matches `docs/example/design.pen`. The `.pen` file is the source of truth. This document turns it into Radix Themes components and props, so you can build without opening the file.

`design.pen` is encrypted. Read it only through the `pencil` MCP tools (`get_app_state`, then `execute` with `Get`, `GetVariables` and `TakeScreenshot`), never with `Read` or `grep`. Open it when you need a value this document leaves out, or to check a screen visually. When this document and the file disagree, the file wins; update this document.

## Principles

- **Radix Themes defaults.** The design is stock Radix Themes in dark appearance. Every `.pen` variable is named after its Radix CSS variable, so `$accent-9`, `$gray-a3` and `$space-3` in the design are `--accent-9`, `--gray-a3` and `--space-3` in code.
- **Components first.** Reach for `Button`, `TextField`, `Card`, `Badge`, `DropdownMenu` and `Dialog` before styling a `Box`. Layout uses `Flex`, `Grid` and `Box` props.
- **No CSS overrides.** Components read every token, font and radius from the theme. A remaining `className` or `style` needs a reason, such as a status icon color, `whiteSpace: "pre-wrap"` to keep the line breaks of a ticket description or comment body, or a value Radix has no prop for (the reasons are given with each recipe below). `src/main.css` holds the few rules Radix props cannot express: `.nav-row:hover` gives nav rows and the account row their `--gray-a4` hover fill (inside `@media (hover: hover)`), because Radix has no hover-fill prop and an inline `style` cannot target `:hover`; the responsive classes are listed under [Mobile](#mobile).
- **Responsive layout is CSS-only.** Radix responsive props first, then documented media-query classes; no viewport checks in JavaScript. Each screen renders one tree, so no field, form, card list or dialog exists twice.
- **Steps, not hex.** Pick a color by scale step and role (see [Color](#color)), never by hex value.
- **Cheap to rebuild.** A mobile and a Next.js app will copy every screen, so keep compositions simple and reuse the components below.
- **Sync is the demo.** Offline state, pending changes, merges and remote edits are always visible in the UI, never hidden in dev tools.

## Theme setup

Import the stylesheet and wrap the app in `<Theme>` once, in `examples/react/src/main.tsx`:

```tsx
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";

<Theme appearance="dark" accentColor="violet" grayColor="gray">
	<RouterProvider router={router} />
</Theme>;
```

Keep the defaults: `radius="medium"`, `scaling="100%"`, `panelBackground="translucent"` and the system font stack. The canvas renders the system stack with Inter and the mono stack with Noto Sans Mono only because system fonts are unavailable there.

## Color

Radix 12-step scales: steps 1–2 are app backgrounds, 3–5 component backgrounds, 6–8 borders, 9–10 solid fills, 11–12 text. Alpha steps (`a1`–`a12`) layer on any surface, so nested panels stay readable. The gray scale is pure `gray`, the accent is `violet`.

| Role                  | Token                                  | Use                                                                                                                                  |
| --------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| App background        | `--color-background` (gray-1)          | Page background.                                                                                                                     |
| Translucent panel     | `--color-panel` (gray-a2)              | Sidebar, board header, columns, cards, sign-in card, link rows.                                                                      |
| Solid panel           | `--color-panel-solid` (gray-2)         | Menus, toasts, dialogs, the ticket modal, the mobile drawer.                                                                         |
| Field surface         | `--color-surface` (black / 25%)        | `TextField`, `TextArea`.                                                                                                             |
| Element fill          | `--gray-a3`                            | Soft buttons, icon boxes, soft badges.                                                                                               |
| Selected / hover fill | `--gray-a4`                            | Active and hovered sidebar rows.                                                                                                     |
| Card border           | `--gray-a5`                            | Cards, columns.                                                                                                                      |
| Separator             | `--gray-a6`                            | Panel edges, header and footer dividers, menus.                                                                                      |
| Field border          | `--gray-a7`                            | Inputs, `Kbd`, filter chips. The file draws ticket modal fields with `gray-a6`; Radix surface fields stay `gray-a7`.                 |
| Placeholder           | `--gray-a10`                           | Placeholder text.                                                                                                                    |
| Secondary text        | `--gray-a11` (`color="gray"`)          | Meta, counts, captions, default icons. There is no third tone. The file also uses solid `--gray-11`, which looks the same on gray-1. |
| Primary text          | `--gray-12`                            | Titles, values, names.                                                                                                               |
| Accent solid          | `--accent-9`, text `--accent-contrast` | Primary button, brand mark, agent avatar, highlighted menu item.                                                                     |
| Accent text           | `--accent-11`                          | Links, merge notes.                                                                                                                  |
| Focus                 | `--focus-8` (accent-8)                 | Focused field border, drop placeholder border.                                                                                       |
| Drop target           | `--accent-a3`                          | Drop placeholder fill.                                                                                                               |

Variants carry color: soft badges and buttons use `color-a3` with `color-a11` text, solid uses `color-9` with white text.

Badge and avatar colors: `violet`, `blue`, `green`, `red`, `amber`, `orange`, `cyan`, `pink`, `gray`. Feedback uses `green` (synced, success), `blue` (syncing, in progress), `amber` (offline, unsaved) and `red` (destructive).

### Label and avatar color

Labels are free-form. `colorFor(name)` in `src/modules/color/label-color.ts` picks one of the eight non-gray colors from the name, so the same name always gets the same color. Labels and person avatars both use it. The label and avatar colors drawn in `design.pen` are sample data, not a mapping to copy: the app keeps computing them with `colorFor`.

## Typography

Size 1–9 sets font size and line height together. Headings use tighter heading line heights and default to bold.

| Style      | Radix                                                     | Size    | Use                                                 |
| ---------- | --------------------------------------------------------- | ------- | --------------------------------------------------- |
| Display    | `<Heading size="6">`                                      | 24 / 30 | Page titles.                                        |
| Modal      | `<Heading size="5">`                                      | 20 / 26 | Dialog title (`AlertDialog.Title`).                 |
| Title      | `<Heading size="4">`                                      | 18 / 24 | Sign-in card title.                                 |
| Heading    | `<Heading size="2">`                                      | 14 / 18 | Section headings, board name.                       |
| Brand      | `<Text size="2" weight="bold">`                           | 14 / 20 | Brand name. Not a heading, so each page has one h1. |
| Card title | `<Text size="2" weight="medium">`                         | 14 / 20 | Ticket titles, button labels, names.                |
| Body       | `<Text size="2" color="gray">`                            | 14 / 20 | Descriptions, comments, helper paragraphs.          |
| Small      | `<Text size="1" color="gray">`                            | 12 / 16 | Assignee names, counts, ticket keys, hints.         |
| Caption    | `<Text size="1" weight="medium" color="gray">`, uppercase | 12 / 16 | Field labels in the modal, sidebar section titles.  |
| Mono       | `<Code size="1" variant="ghost">`                         | 12 / 16 | Link meta: PR numbers, commit hashes.               |

## Shape, space and depth

- **Radius:** `radius="medium"` sets `--radius-1…6` (3, 4, 6, 8, 12, 16px). Buttons (size 2), fields and small avatars use 2; badges, chips, icon buttons and `Kbd` use 1; header buttons, selects, tabs and the account row use 3; menus and cards 4; dialogs and the sign-in card 5. The brand mark is the only exception: it uses radius 3, which its `Avatar` gets from `radius="large"` (1.5 × radius 2 = 6px).
- **Spacing:** `--space-1…9` (4, 8, 12, 16, 24, 32, 40, 48, 64px) back every layout prop: `p="3"` is 12px, `gap="2"` is 8px. Values off the scale are not used.
- **Shadow:** menus and toasts use `--shadow-5`, dialogs `--shadow-6`. Cards stay flat with a `gray-a5` border.

## Icons

Icons are [Phosphor](https://phosphoricons.com) (`@phosphor-icons/react`), regular weight. Sizes: 12px in card footers and labels, 14px in status and menus, 16px in inputs, buttons, nav items, icon buttons and toasts. Icons default to `gray-a11`. Phosphor ships no dotted circle, so the Backlog status icon `CircleDottedIcon` (`components/status/circle-dotted-icon.tsx`) draws one with Phosphor's `IconBase` in the regular weight; it uses `--gray-11`, as the file does.

| Meaning                                     | Icon                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Status backlog / to do / in progress / done | `CircleDotted` gray / `CircleDashed` gray / `RadioButton` `--blue-11` / `CheckCircle` `--green-11` |
| Board, brand mark                           | `Kanban`                                                                                           |
| Assigned to me (sidebar)                    | `Tray`                                                                                             |
| New, close, more                            | `Plus`, `X`, `DotsThree`                                                                           |
| Comments, links, copy link                  | `ChatCircle`, `Link`                                                                               |
| Breadcrumb, select chevron                  | `CaretRight`, `CaretDown`                                                                          |
| Search (inputs, menus)                      | `MagnifyingGlass`                                                                                  |
| Sync note, presence, device row             | `GitMerge`, `Desktop`, `Laptop`                                                                    |
| Switch user, toast                          | `Users`, `AppWindow`                                                                               |
| Link rows                                   | `GitPullRequest`, `GitCommit`, `FileText`                                                          |
| Synced                                      | `CloudCheck`                                                                                       |
| Filter, label                               | `Funnel`, `Tag`                                                                                    |
| Delete, sign out, save                      | `Trash`, `SignOut`, `Check`                                                                        |
| Passkey button, passkey device              | `Key`, `Fingerprint`                                                                               |
| Agent, unassigned, mobile assignee chip     | `Robot`, `User`                                                                                    |
| Menu, back (mobile header)                  | `List`, `ArrowLeft`                                                                                |

## Components

Each entry names the `.pen` component, then the Radix recipe that reproduces it.

### Actions

| `.pen` component   | Radix                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button/Solid`     | `<Button>`, solid violet, size 2 (32px; the file draws 30px). One per view, for the primary action. Optional trailing shortcut, e.g. "New" `C` (a custom chip in the file, not `Kbd`; not built). |
| `Button/Soft`      | `<Button variant="soft" color="gray">`. Secondary: Cancel, Close, Sign out.                                                                                                                       |
| `Button/Ghost`     | `<Button variant="ghost" color="gray">`. Tertiary: Copy link, Add filter, toast actions. Compact form is `size="1"`.                                                                              |
| `Button/Solid Red` | `<Button color="red">`. Destructive: Delete.                                                                                                                                                      |
| `IconButton`       | `<IconButton size="1" variant="ghost" color="gray">`, 16px icon: 24px, where the file draws 28px with radius 1 (`size="2"` gives 28px).                                                           |
| `Kbd`              | `<Kbd>`                                                                                                                                                                                           |

The sign-in passkey button is `<Button size="3">` at full width. Its `Key` icon and label sit in a `Flex gap="2"` (8px; Radix size 3 spaces them 12px), and the label is `<Text size="2" weight="medium">` (14px).

### Inputs

| `.pen` component | Radix                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Input`          | `<TextField.Root>`, surface, size 2 (32px). Optional leading `TextField.Slot` icon and trailing `<Kbd>`.                                                                                                                                                                                                                                                                                                        |
| `Field`          | `Flex direction="column" gap="1"`: label `<Text as="label" htmlFor size="1" weight="medium" color="gray">`, the input, hint `<Text size="1" color="gray">`, error `<Text size="1" color="red">`. The label's `htmlFor` targets the control's id, and the hint and error describe it. Caption-labelled fields in the ticket modal use `gap="2"`. A `Select` wraps the field so the id lands on `Select.Trigger`. |
| `Textarea`       | `<TextArea>`, surface, size 2.                                                                                                                                                                                                                                                                                                                                                                                  |

### Labels, status and avatars

| `.pen` component    | Radix                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Label`             | `<Badge variant="soft" size="1" color={colorFor(name)}>`, 20px tall. In the ticket modal, a trailing `X` (12px) removes it; the badge keeps its height.                                                                                                                                                                                                                                                                         |
| `Tag`               | `<Badge asChild size="1" variant="outline" color="gray">` around `<Link asChild underline="none" color="gray" weight="regular">` around a `button`, with a leading `Plus` (12px): 20px tall, 12px regular text, `gray-a8` outline. Label suggestions and the mobile "+ Add label". The badge gives the file's size and outline (Radix `Button` size 1 is 24px and medium weight); the `Link` gives the `button` its focus ring. |
| `Status`            | `Flex gap="1" align="center"`: status icon (14px, in its status color) and `<Text size="2" weight="medium">`. The icon carries the color.                                                                                                                                                                                                                                                                                       |
| `Avatar`            | `<Avatar size="1" variant="soft" color={colorFor(name)} fallback={initials(name)}>`. Radius 2, not round. `PersonAvatar` renders it `asChild` on a `<span aria-hidden>`, because Radix `Avatar` passes other props to its image, not its root, so a plain `aria-hidden` would leave the initials in names.                                                                                                                      |
| `Avatar/Agent`      | `<Avatar size="1" variant="solid" fallback={<Robot />}>`. An agent is a user with no passkeys.                                                                                                                                                                                                                                                                                                                                  |
| `Avatar/Unassigned` | Outlined avatar: a `Flex` the size of the Radix avatar, radius 2, an inset `gray-a7` border and the `User` icon (14px, `gray-a11`). Radix `Avatar` has no outline variant, so the border and radius are a `style`.                                                                                                                                                                                                              |
| `Assignee`          | `Flex gap="2" align="center"`: avatar plus name in `<Text size="1" color="gray">`. Unassigned shows only the `Avatar/Unassigned`, with no text; there the avatar is `role="img"` named "Unassigned", so a ticket card's link name still says it.                                                                                                                                                                                |

The `.pen` avatar is 20px inline (assignee, menu items) and 24px in comments and the sidebar, 28px in the account menu and 56px on the Profile page. Radix `size="1"` is 24px, so inline avatars render slightly larger in code.

### Board

- **`Column`**: `<Card size="1">` (`color-panel`, `gray-a5` border, radius 4, `p="3"`), cards stacked with `gap="2"`. On the board, columns share the width and fill the height.
- **`Column Header`**: 32px row, `pl="2" pr="1" gap="2"`: `Status`, count in Small, a spacer, then `Plus` and `DotsThree` icon buttons (24px, 14px icons). The Board screen hides both buttons, and so does the app.
- **`Ticket Card`**: `<Card size="1">`, `Flex direction="column" gap="2"`.
  - Top row: title in Card title style, key in Small.
  - Labels row: `Flex wrap="wrap" gap="1"`.
  - Footer `gap="3"`: comment count (`ChatCircle`) and link count (`Link`), 12px icons in Small, then `Assignee` pushed right.
  - Sync note, only right after a remote change: top border `gray-a6`, `pt="2"`, `--accent-11` text with a merge icon, e.g. "Merged from MacBook · just now".
- **`Drop Placeholder`**: 72px, `--accent-a3` fill, `--focus-8` border, radius 4.
- **`Add Ticket`**: full-width 36px row at the bottom of each column, `px="2" gap="2"`, no fill: `Plus` (14px) and "New" in `<Text size="2" weight="medium">`, named "New ticket in {status}" for screen readers. Build it as a `button` inside `<Link asChild underline="none" color="gray">` inside `<Flex asChild>`, so it keeps the focus ring without a ghost button's negative margins.

### Navigation and sync

- **`Nav Item`**: 30px row, radius 2, `px="2" gap="2"`: 16px icon, label `<Text size="2">` in `gray-11`, trailing count in Small. The row is `<Link underline="none" color="gray" highContrast={active}>`, so the icon and label inherit `gray-11`, or `gray-12` when active. The active item has a `--gray-a4` fill, and every row gets the same fill on hover (`className="nav-row"`). Label filters use an 8px dot in the label color at step 11 in place of the icon.
- **`Nav Section`**: a `Flex direction="column" gap="1"`: a `Flex pt="4" px="2" pb="1"` with a Caption title, e.g. "LABELS", then its nav items. Nav rows are 4px apart everywhere (the nav list and each section use `gap="1"`): 30px + 4px in the sidebar, 44px + 4px in the drawer. The title row is a `Flex`, not a `Box`, so the caption's line box stays 16px and the section header is 36px.
- **`Sync Status`**: `<Badge size="2">` with a 6px dot and the state text, plus `role="status"`. The file spaces dot and text 4px; Radix Badge size 2 uses 6px.

  | State   | Color   | Detail example            |
  | ------- | ------- | ------------------------- |
  | Synced  | `green` | none                      |
  | Syncing | `blue`  | "3 → server"              |
  | Offline | `amber` | "3 changes saved locally" |

- **`Presence`**: `<Badge size="2" variant="surface" color="gray">` with a 14px device icon and text like "2 tabs · 3 devices". The file spaces them 8px; Radix Badge size 2 uses 6px.
- **`Filter Chip`**: 26px, `--gray-surface` fill, `gray-a7` border, radius 1: icon and key in `gray-a11`, value in `<Text size="1" weight="medium">`, clear `IconButton` (18px).

### Ticket detail

- **`Property`**: 32px row, `gap="3"`: key `<Text size="2" color="gray">` 96px wide, value is a component (`Status`, `Assignee`, labels).
- **`Link Row`**: 36px `Card`-styled row, `px="3" gap="2"`: 14px icon (a merged PR in `--green-11`), title `<Text size="2">`, meta in Mono such as `#212`. Built as `<Card asChild size="1">` around a `Flex align="center" px="3" py="0" height="36px"`: `GitPullRequest` (`--green-11`), `GitCommit` or `FileText` (`--gray-a11`), the title as `<Link size="2" color="gray" highContrast underline="hover" truncate>` that opens the URL in a new tab (plain `<Text size="2">` when the URL is not http or https; an empty title falls back to one derived from the URL), the meta in `<Code size="1" variant="ghost" color="gray">`, then a ghost `IconButton` with `X` named "Remove {title}".
- **`Comment`**: `Flex gap="2"`: `Avatar` (24px), then a column with a head (author in Card title style, time in Small) and the body in `<Text size="2">` `gray-11`. Agent comments use `Avatar/Agent`.
- **`Remote Cursor`**: another user typing in the description. A 2×18px caret plus a flag (radius 2 except the top left, 10px medium white text, "Name · Device"). Both use the user's color at step 9, e.g. `--orange-9`.

### Overlays and feedback

Overlays sit on `--color-panel-solid` with a `gray-a6` border.

- **`Menu`**: `<DropdownMenu.Content>`, 240px, radius 4. Optional search row on top, 32px, with a bottom `gray-a6` border.
- **`Menu Item`**: `<DropdownMenu.Item>` (size 2, 32px; the file draws 30px with 4px between items): optional leading avatar or icon, label, meta in Small, trailing `Check` when selected. The highlighted item is solid accent with white text.
- **`Toast`**: radius 4, `p="3" gap="3"`, `--shadow-5`: 16px icon in a feedback color (`CloudCheck` green), title in Card title style, text in Small `gray-11`, optional compact ghost action. Sits bottom right.
- **`Dialog`**: `<AlertDialog.Content maxWidth="400px">` (Radix defaults to 600px), radius 5: title `<AlertDialog.Title>` (size 5, bold), description size 3 `gray-11`, then right-aligned actions with `gap="3"`: soft gray "Cancel", then the confirming button (red for deletes).
- **`Account Menu`**: a `Menu` whose top row shows the user (`Avatar` 28px, name in Card title style, meta "Passkey · this MacBook" in Small) above a `gray-a6` divider, then "Switch user" and "Sign out" items.
- **`Device Row`**: 420px `Card`-styled row, `p="3" gap="3"`: 32px `gray-a3` icon box with a 16px icon, title in Card title style above meta in Small (e.g. "Chrome · 2 tabs open"), then a trailing `IconButton`.

## Screens

All desktop screens are 1440×900 frames on `--color-background`. Screen ids: Sign in `AheN1`, Sign up `d9ByK4`, Board `lB46j`, Ticket `pa14g`, Profile `ttW4Q`. The mobile frames are 390px wide; see [Mobile](#mobile).

### Sign in and sign up

Both pages share `AuthCard` (`src/features/authentication/components/auth-card`). The brand (24px `--accent-9` mark, radius 3, white `Kanban` icon, the name "Board" in Brand style) sits in the top left corner, `position="absolute" top="6" left="7"`. The **`Sign-in Card`** is centered: `<Card size="3">`, 360px wide including its padding, `gap="4"`. It holds a head group (`gap="1"`: a 32px accent mark with `pb="2"` below it, a Title and a Body line; the mark sits 12px above the title where the file leaves about 14px), a name `Field` with a hint (sign up only), the full-width `<Button size="3">` passkey button with a `Key` icon, and a centered switch line (`Flex justify="center" gap="1"`: `<Text size="1" color="gray">` and an accent `<Link size="1" weight="medium" underline="hover">`). A blank name shows the field error "Enter a name.", and a failed passkey shows a red Small line with `role="alert"`. Accounts are passkey only.

### Board

- **Sidebar**: 240px, `--color-panel`, right `gray-a6` border, `py="3" px="2" gap="1"`. Brand row (`p="2" pb="4"`), nav items (Board, Assigned to me), a "LABELS" section with one nav item per label, a spacer, then the account row (radius 3, `p="2"`, avatar and name) that links to `/profile`. The row gets `--gray-a4` when Profile is open and on hover. The design's Agents nav item is hidden there and not built.
- **`Board Header`**: 52px, `--color-panel`, bottom `gray-a6` border, `px="4" gap="3"`. Left to right: a title group (`gap="2"`: `Kanban` icon, board name in Heading style, ticket count in Small, "24 tickets"), a 1×16px `gray-a6` divider, filter chips plus a compact ghost "Add filter", a spacer, `Presence`, `Sync Status`, and the primary "New" button (`Plus`) with its `C` shortcut chip (not built). Its `aria-label` is "New ticket", which contains the visible "New".
- **Columns**: `p="4" gap="4"`, four equal `Column`s: Backlog, To do, In progress, Done. The app is bounded to the viewport (`height="100dvh"` on the root), so the sidebar and header stay put and each column's card list scrolls on its own.

### Ticket modal

Opening a ticket dims the board with a scrim and centers a 920px modal on `--color-panel-solid`, radius 5, `gray-a6` border. `Dialog.Content` is `align="center"`, but Radix pads the scroll area 32px on top and `max(32px, 6vh)` below, which sits the modal about 12px high at 900px. A bottom margin of `calc(var(--space-6) - max(var(--space-6), 6vh))` from `md` up (in the `.ticket-dialog` class) evens the padding, so the modal is centered as in the file (top 75px for the 750px modal at 900px; the file's modal is 746px tall at top 77, because its footer buttons are 30px and the app's 32px).

By product decision the app has one modal: every field is editable as soon as it opens, and changes to an existing ticket save as you go. It uses the layout of the `.pen` ticket screen (`pa14g`): there is no read-only mode, no "Unsaved changes" marker and no Save or Cancel for an existing ticket. Status, assignee and labels save the moment they change. Title and description save when the field loses focus and when the modal closes. A blank title is not saved and reverts to the stored one. A new ticket writes nothing until "Create ticket" or `⌘↵`.

- **Header** 52px, `pl="4" pr="3" gap="2"`, bottom `gray-a6` border: breadcrumb (`Kanban` icon, board name `<Text size="2" weight="medium">` `gray-11`, `CaretRight` 14px, key in `<Text size="1">` `gray-12`), spacer, then compact ghost "Copy link" with a `Link` icon and a close `IconButton` named "Close ticket" (the footer button is "Close"). A new ticket has no key and no "Copy link".
- **Body**, 640px tall: a `Grid` with `areas` `"title sep details" "body sep details"` and `columns="minmax(0, 1fr) auto 360px"`, in reading order title, details, body (see [Mobile](#mobile)). The title cell stays put while the body cell scrolls.
  - Content `p="5" gap="5"`, scrolling when it overflows: a Caption-labelled "TITLE" `TextField` (size 3), a "DESCRIPTION" `TextArea` (`radius="large"`, 6px) that fills the remaining height (the field, caption included, is at least 200px, so the editor is at least 176px). The file pads the description 12px; Radix size 2 pads it 6px × 8px and has no padding prop, so the `TextArea` root gets the difference as `style` padding with `backgroundClip: "border-box"` (Radix clips the fill to the content box, which would show the padding as a ring), then the comments under a "COMMENTS · 3" Caption (`gap="3"`) and a comment `TextArea` that posts on `⌘↵`, with a Small hint below it ("⌘↵ to post", "Ctrl+↵ to post" off macOS) that describes it. A new ticket has no comments.
  - Details 360px, `p="5" gap="4"`, left `gray-a6` border: Caption-labelled controls for Status (`Select`), Assignee (`Select`), Labels (an input that adds on Enter, removable labels, and a "Suggested" row of `Tag`s) and Links. Both `Select.Trigger`s are `radius="large"` (6px). The status trigger and options show `Status` (icon and medium-weight name). The assignee trigger and options show the avatar beside the name (`PersonAvatar size="1"`, the unassigned avatar for "Unassigned"), in a `Flex gap="2"`. "LINKS" lists one `Link Row` per link, then a `TextField` with the placeholder "Paste a URL…" (the file's "Paste a URL or PR number…"; PR numbers are not supported) and a trailing `<Kbd>↵</Kbd>` in a `TextField.Slot`. Enter adds an http or https URL; other text shows the field error "Enter a URL.". Pull request and commit URLs show as "PR #212" and "Commit a3f9c21". Only saved tickets have links.
- **Footer** `py="3" px="4" gap="2"`, top `gray-a6` border, `--gray-a2` fill (the closest token to the file's `#ffffff05`, set by the `.ticket-footer` class from `md` up). Existing ticket: red "Delete" on the left (confirmed with a `Dialog`), soft gray "Close" on the right. New ticket: soft gray "Cancel" and primary "Create ticket" with a `Check` icon on the right.

### Profile

Sidebar as on the board, with the account row active. The main area reuses `Board Header`, then content at `py="7" px="8" gap="7"`:

The header shows a `User` icon and "Profile", with filters, presence, sync status and the new-ticket button hidden.

- **Identity** row, `gap="4"`: 56px avatar, name (Display) above a stats line ("Member since Oct 12, 2026" in `<Text size="2" color="gray">`, a divider, then counts for created, assigned and comments in Small with medium-weight numbers), a spacer and a soft gray "Sign out".
- **Profile** section, 560px wide, `gap="4"`: a `gap="1"` group with the Heading and Body description ("Your name appears on tickets and comments, and syncs to every device."), the name `Field` with its hint ("Shown on tickets and comments you write."; sign up keeps "Shown on tickets and comments."), the language `Field` (a `Select`, app only, since the design has no language control), then right-aligned ghost "Cancel" and primary "Save changes" with a `Check` icon. The row uses `gap="4"` because a ghost button's negative margin eats 8px of the design's 16px between "Cancel" and "Save changes".

## Mobile

<!-- cspell:ignore djdk heebe minmax -->

Below Radix's `md` breakpoint (1024px) the app switches to the mobile frames: Sign in `RPoF9`, Sign up `djdkR`, Board `heebe` (menu button) and `sNnh2` (menu open), Ticket `A5yTpp` and Profile `zE6Aq`. The frames' status bar ("9:41") and home indicator are device chrome and are not built.

- **Switching.** Responsive layout is CSS-only. Every screen renders one tree and arranges it with Radix responsive props (`{ initial: …, md: … }`, which compile to `@media (min-width: 1024px)` rules). Chrome that exists on one layout only renders once and is hidden on the other with `display`: `MobileHeader`, `BoardFilters`, `StatusTabs` and `ActionBar` carry `display={{ initial: …, md: "none" }}`, and `Sidebar`, `PageHeader` and the ticket's desktop header carry `display={{ initial: "none", md: … }}`. Hidden with `display: none`, the other layout's chrome leaves the accessibility tree, so each viewport still has one h1 and no two visible controls share a name (the desktop ticket's header X is "Close ticket", its footer button "Close"). React keeps behavior state only (the selected status tab, the open drawer, the revealed label input); CSS decides whether it shows. Nothing reads `matchMedia` or the window size.
- **CSS fallback.** Where no Radix prop can express a style, a class in `src/main.css` does, inside `@media (width < 1024px)` (mobile only) or `@media (min-width: 1024px)` (desktop only), both at Radix's `md` breakpoint:

  | Class               | Used on                                   | Rule and reason                                                                                                                                                                                                                                                                |
  | ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `.desktop-card`     | `AuthCard`                                | Below `md`: no `Card` padding, fill or border (`--card-padding: 0`, `::before` and `::after` hidden, no clipping). Radix `Card` has no responsive variant, and the mobile frames draw the sign-in form without a card.                                                         |
  | `.ticket-dialog`    | `TicketModal`'s `Dialog.Content`          | Always `--dialog-content-padding: 0`, replacing an `Inset`. Below `md`: fixed at the viewport origin, no margin or radius, `--color-background`, because Radix `Dialog` has no sheet and no position prop. From `md`: the balanced bottom margin described under Ticket modal. |
  | `.ticket-footer`    | `TicketFooter`                            | From `md`: `--gray-a2` fill; the mobile footer sits on the page background. Radix has no responsive background prop.                                                                                                                                                           |
  | `.profile-stats`    | The Profile stats grid                    | Below `md`: top and bottom `gray-a6` borders. Radix has no border prop.                                                                                                                                                                                                        |
  | `.stat-number`      | `StatNumber`                              | Below `md`: `display: block` and `--gray-12`, the number above its label. Radix `Text` has no display prop, and `highContrast` is not responsive.                                                                                                                              |
  | `.profile-actions`  | The Profile Cancel and Save changes group | Below `md`: top `gray-a6` border and `--color-background`, so the sticky bar covers content scrolling under it.                                                                                                                                                                |
  | `.bar-ghost-button` | The Profile ghost "Cancel"                | Below `md`: 48px `height`, `box-sizing: border-box`, no margin, because Radix ghost buttons are content-box with negative margins.                                                                                                                                             |

- **Height.** The root fills `100dvh`, not `100vh`, so mobile browser chrome cannot hide the action bars.
- **Touch size.** Header buttons are 40px and action-bar buttons 48px. Drawer nav rows are 44px (`NavItem size="2"`).

### Recipes

- **`MobileHeader`** (`src/components/mobile-header`): 56px, `--color-panel`, bottom `gray-a6` border, `px="4" gap="3"`. A leading `HeaderButton` (`<IconButton size="3" variant="soft" color="gray" highContrast>`, 40px, 20px icon: `List` opens the drawer, `ArrowLeft` goes back), the title (`<Heading as="h1" size="6">`, 24/30, the page's one h1) over a Small subtitle, then trailing header buttons.
- **Filters row** (`BoardFilters`): `Flex gap="2"`. A mobile `Filter Chip` per active filter ("Assignee Me", "Label bug"): 32px, `pl="2" pr="1" gap="1"`, `--gray-surface` fill, inset `gray-a7` border, radius 1, a 14px `User` or `Tag` icon, key in Small, value in `<Text size="1" weight="medium">`, then a clear `<IconButton size="1" variant="ghost" color="gray">` with a 12px `X` that drops the filter from the URL. Last comes a compact ghost "Filter" button (`<Button size="2" variant="ghost" color="gray" ml="2">`, `Funnel`) that opens the drawer, where the filters live. With no filter only "Filter" shows. The chip's fill, border and radius are a `style`, because Radix has no chip component.
- **Status tabs** (`StatusTabs`, `src/components/status-tabs`): four content-width tabs, Backlog first, in a 44px track (`Flex role="radiogroup" justify="between" gap="1" p="1"`, `--gray-a3` fill, radius 4) that scrolls sideways only if it ever overflows. Each tab (`StatusTab`) is `Flex asChild align="center" justify="center" gap="1" px="2"` on `<Link asChild underline="none" color="gray" highContrast={selected}>` on a `button` with `role="radio"`: the status icon (14px) on the selected tab only, the name in `<Text size="2" weight="medium">` and the count in Small. The selected tab has a `--gray-a5` fill and radius 3, and `gray-12` text. Radix `SegmentedControl` sizes every segment to the widest one and slides an equal-width indicator, so it cannot draw content-width segments; the track and selected fills are a `style` for the same reason as `Nav Item`. The tabs keep radio semantics: one tab stop on the selected tab, arrow keys, Home and End move the selection, and each name includes the count. "To do" is selected by default; the selection is local state. With the counts shown, the four tabs fit 358px at a 390px viewport.
- **`ActionBar`** (`src/components/action-bar`): the board's bottom bar, hidden from `md` up: a `Grid` with `gap="2" px="4" pb="3"` and no divider. The single primary "New" (`Plus`) is `size="4"` (48px) with the label in `<Text size="2">`, so it keeps the file's 14px type; it is named "New ticket in {status}" for screen readers and opens a new ticket in the active tab's status, seeded from the board filter. The ticket footer and the Profile actions are not an `ActionBar`: they are the desktop rows rearranged by responsive props.
- **Drawer** (`src/features/navigation/components/drawer`): a Radix `Dialog` (focus trap, Escape and scrim click close it) titled "Menu" for screen readers. Its content is a 300px, `100dvh` sheet on `--color-panel-solid` with a right `gray-a6` border, pinned to the left edge with a `style` (position, no margin, padding or radius), because Radix has no sheet. It renders the sidebar content (`SidebarContent`) with 44px rows; following any of its links closes it.
- **Cards**: the board renders four `Column`s once. Below `md` the `Grid` is one column and only the column of the selected status tab shows (`display={{ initial: selected ? "flex" : "none", md: "flex" }}`); its header is hidden and `.desktop-card` drops the card chrome, so the `section` named after the status is a plain card list. The filters row, tabs and cards scroll together in a `p="4" gap="4"` column. "New" in the action bar uses the selected tab's status; the desktop header's "New" uses To do.
- **Labels** (`LabelInput`): one editor with one typed-text state. The "LABELS" caption is the input's `label`. From `md` up the input comes first, then the removable labels and the "Suggested" row. Below `md` a `column-reverse` puts the labels in one wrapping row (`gap="1"`) with an outline "+ Add label" `Tag` (hidden from `md` up) above the input, and the input and "Suggested" row stay hidden until the tag reveals them (local state, focus moves to the input). Enter adds the label and keeps the input open; Escape, or leaving the input empty, hides it again, and Escape returns focus to "+ Add label" without closing the ticket. Pressing a suggestion keeps focus in the input. Because of the `column-reverse`, the revealed input renders below the badges but precedes them in the DOM.
- **Ticket**: one `Dialog` for both layouts. `Dialog.Content` is `width={{ initial: "100vw", md: "100%" }} maxWidth={{ initial: "100vw", md: "920px" }} height={{ initial: "100dvh", md: "auto" }}` with `.ticket-dialog`. Below `md` the header is a `MobileHeader` with Back (`Dialog.Close`), the key over the board name (plain text, not a heading) and a Copy link header button for saved tickets; from `md` up the breadcrumb header shows instead. The body is one `Grid` whose cells come in reading order: title, details (Status, Assignee, Labels), body (Description, Comments). Below `md` its `areas` are `"title" "details" "body"` (`p="4" gap="5"`, rows `auto auto 1fr`, scrolling); from `md` up the 640px two-pane layout with the vertical `Separator` in a `sep` cell, where the details and body cells scroll on their own. The footer is one `Grid`: two equal columns of `size="4"` buttons below `md`, the desktop row from `md` up (`columns="auto auto"`, Delete and Close apart, Cancel and Create ticket at the end). Saving and deleting behave the same on both layouts.
- **Sign in and sign up**: one `AuthCard` tree. Below `md` the page has `p="5"`, `.desktop-card` removes the card, and the form fills the height: the brand (32px mark with "Board" in `<Text size="4" weight="bold">`, shown below `md` only through `Brand`'s `nameDisplay`; the corner brand is hidden), `pb="7"` that with the head's `gap="2"` makes 48px, the head (`<Heading size={{ initial: "7", md: "4" }}>`, body `<Text size={{ initial: "3", md: "2" }}>`) and the sign-up name field (`TextField size={{ initial: "3", md: "2" }}`, so iOS does not zoom) at the top, `gap="5"` apart. The passkey `<Button size={{ initial: "4", md: "3" }}>` (label size 3 below `md`) and a 44px switch line in size 2 sit at the bottom.
- **Profile**: one form. The page is a `Grid` with responsive `areas`: from `md` up `"identity identity sign-out" "form . ." "actions . ."` with `columns="560px 1fr auto"`, below `md` one column `"identity" "form" "sign-out" "actions"` with the last row `1fr`. `Identity` is a `Grid` too: the 64px avatar beside the name (`<Heading as="h2" size="6">`), and the stats either under the name (from `md` up) or in a full-width `columns="2" py="4"` row with `.profile-stats` borders, each `Stat` number (`StatNumber`) a `<Text size="5" weight="bold">` above its Small label. "Sign out" is `size={{ initial: "4", md: "2" }}`, full width below `md`. The Cancel and Save changes group is the desktop's right-aligned row from `md` up and below `md` a `position="sticky" bottom="0"` bar of two equal `size="4"` buttons with `.profile-actions`; Save changes submits the form through its `form` attribute, so typed text survives a resize.
- **Reading order.** The DOM follows the mobile reading order and grid `areas` place cells on desktop: the ticket's fields are Title, Status, Assignee, Labels, Links, Description, Comments in both, and Profile's "Sign out" follows the form and its Cancel and Save changes in the DOM, while it shows beside the name on desktop and above the sticky action bar on mobile.

### Differences from the mobile frames

- The passkey button is 48px (`Button` size 4) where the file draws 52px, and the sign-up input 40px where it draws 48px. Field labels and hints stay 12px where the mobile frames use 14px.
- The ghost "Filter" button is 28px tall and the chip's clear button 20px (`IconButton size="1"` ghost with a 12px `X`) where the file draws 32px and 18px.
- Stat numbers are `Text size="5"` (20 / 28) where the file sets 20 / 26.
- The sign-up `TextField` size 3 has radius 3 (6px) where the file draws radius 4 (8px); on desktop both use radius 2.
- Ticket cards keep the desktop footer (comment count, link count, assignee with name); the file's sync notes are not built.
- The description field keeps its 200px minimum height (a 176px editor); the file draws the editor 116px tall.
- The nn devtools "DevTools" button floats over the bottom right of the action bars; it is a library overlay, not part of the design.

## Not built in the example app

These `.pen` elements keep their recipes above, but `examples/react` does not render them yet, because the board screen hides them or they need library hooks the app does not have: Presence, Sync Status, desktop filter chips and "Add filter" (the mobile board shows chips), drag and drop with its drop placeholder, toasts, remote cursors, "Merged from…" sync notes, the column `DotsThree` menu, the `C` shortcut chip and the `⌘↵` `Kbd` hint (the comment box has a plain-text hint instead), the Agents nav item, "Member since" and the "created" count, Markdown rendering and its "Markdown supported" hint, the Account Menu and the Device Row.

The app also differs from the file where Radix has no matching prop:

- Avatars are 24px (`size="1"`) where the file draws 20px, in the assignee select too, and 64px (`size="5"`) where it draws 56px.
- The title is a size 3 `TextField` (16px regular, 40px), not the file's 20px bold title input (42px, radius 3).
- The desktop header adds a compact ghost "Copy link", mirroring the mobile header; the file's desktop header has only close.
- The desktop modal lists the comments with a comment box, as on mobile; the file collapses them into a "COMMENTS · 3" row (`ChatCircle` 14px, top `gray-a6` border, `pt="4"`).
- On desktop, labels sit below the labels input as removable badges instead of inside it. On mobile, the badges and a "+ Add label" tag come first and the input appears only after tapping the tag.
- The column `Plus` and the bottom "New" row (`Add Ticket`) are not built; new tickets come from the board header's "New" and the mobile action bar.
