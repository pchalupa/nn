<!-- cspell:words Michroma Plex Lucide goodstate wordmark AOS LOS Godspeed starfields npmjs WCAG hoodies -->

# Goodstate visual guidelines

How Goodstate looks and sounds in the README, release posts and social cards, and internal tools. Tokens are in [`tokens.css`](tokens.css). Mermaid diagrams and their rules are in [`diagrams.md`](diagrams.md).

The source of truth is the brand book, the _Goodstate Visual Identity Guidelines_ frame in [`brand-book/brand-book.pen`](brand-book/brand-book.pen). This guide follows it, with four deliberate departures, each marked **Departs from the book**: status names, small orange text, claims about data loss, and borrowed place names.

The packages are published as `@goodstate/*`. Where the book shows `goodstate` or `goodstate/react`, use the scoped names.

## 1. The idea

"Loss of signal is not loss of state." Apollo crews lost contact with Earth behind the Moon and kept flying, because the spacecraft carried everything it needed. A Goodstate replica works the same way: it holds the whole state, works offline, and converges with the others when the link returns.

Goodstate borrows its look from mission control: flight plans, checklists, instrument panels. It doesn't borrow the look of outer space. It should read like a spacecraft's engineering manual, not a movie poster. Its personality is calm under pressure, engineered rather than decorated, and optimistic. It is not sci-fi neon, rocket emoji, hype, glassy gradients, "blazing fast", or hacker green.

Each package gets one metaphor, and these are the only ones to use:

| Package                 | Metaphor        |
| ----------------------- | --------------- |
| `store`                 | The spacecraft  |
| CRDT merge (`entities`) | Docking         |
| `indexdb-sync`          | Flight recorder |
| `sse-sync`              | Ground link     |
| `broadcast-sync`        | Crew intercom   |
| Relay server            | Relay station   |

## 2. Basics

### Color

| Name          | HEX       | Role                                                                   |
| ------------- | --------- | ---------------------------------------------------------------------- |
| Sunlight      | `#FAF0DE` | Primary surface for docs, print, and light UI. Text on dark.           |
| Martian Night | `#1C130C` | Default canvas for code, terminals, and dark docs. Text on light.      |
| Paper         | `#EEDDC2` | Secondary surface: callouts, table hover, long-form.                   |
| Mars Orange   | `#D9621E` | Signal. The one fill per view: the action or number that matters most. |
| Bronze        | `#B48A55` | Terms, comments, labels, and rules on dark.                            |
| Amber         | `#F5A623` | Live status on dark.                                                   |
| Rust Dust     | `#8E4A26` | Offline and degraded states on light, illustration.                    |
| Muted Ink     | `#6B4A34` | Captions, metadata, secondary text on light.                           |

- Use the colors in roughly this ratio: 40% Sunlight, 30% Martian Night, 14% Paper, 7% orange, and the rest support colors.
- Build components from the semantic `--gs-color-*` tokens. They switch between light and dark on their own.
- One Mars Orange fill per view. Thin indicators (the active nav bar, the selected tab, the focus ring) and section numbers don't count toward it.
- Text on orange is always Martian Night, never Sunlight.
- **Departs from the book.** The book sets 13px section numbers in Mars Orange on Sunlight, which is 3.3:1 and fails AA. Use `--gs-color-accent-text` (`#A3410E`) for orange text under 24px on light backgrounds. It keeps the hue at 5.6:1.
- Amber on Sunlight (1.8:1) is decorative only. Rust Dust on Night (2.75:1) is never used for text, so the book's Rust file label in code headers becomes Bronze.
- The instrument panel (`--gs-panel-*`) stays dark in both themes. Use it for code blocks, status chips, terminals, and DevTools.
- The semantic tokens use `light-dark()`, which needs Chrome 123 or Safari 17.5. Surfaces that support older browsers set colors from the base tokens per theme instead.

### Type

Three families, each with one job, plus a serif for quotes. The sizes below are the desktop values, and the `--gs-text-*` tokens scale them down on small screens, never taking Michroma under 32px. All are free (SIL OFL) on Google Fonts.

| Family         | Use                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------- |
| Michroma       | Headlines, the primary tagline, big statements. 400 only, 32px and up, about eight words. |
| IBM Plex Sans  | Paragraphs, UI copy, names. Titles at 500, body at 400.                                   |
| IBM Plex Mono  | Labels, figures, status, code. Always for numbers in UI.                                  |
| IBM Plex Serif | Only quotations from real people, such as "Godspeed, John Glenn.", with the attribution.  |

| Style    | Spec                                                  |
| -------- | ----------------------------------------------------- |
| Display  | Michroma 72 / 1.15 / −1px (`--gs-tracking-display`)   |
| Headline | Michroma 40 / 1.2 / −0.5px (`--gs-tracking-headline`) |
| Title    | Plex Sans 500 · 30 / 1.25                             |
| Body     | Plex Sans 400 · 16–18 / 1.55                          |
| Quote    | Plex Serif 400 · 26 / 1.3                             |
| Label    | Plex Mono 12–13, caps, +1.5px                         |
| Code     | Plex Mono 14–15 / 1.6                                 |

```html
<link
	rel="stylesheet"
	href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Serif&family=Michroma&display=swap"
/>
```

Michroma has no bold or italic, so never fake them. Write numbers (timestamps, counts, versions) in mono with `tabular-nums`.

### Mono labels

The most recognizable device is uppercase Plex Mono with +1.5px (0.12em) tracking. Use it for:

- Section numbers: two digits, an em dash, the name (`04 — THE IDEA`). Orange on light, orange or amber on dark.
- Figure captions (`FIG. 03 — MISSION CONTROL, HOUSTON`), status, table headers, file names, and button labels.

Keep a label under six words. On web pages, type it in sentence case and uppercase it in CSS, because some screen readers spell out capitals. GitHub strips CSS, so in README Markdown keep labels in sentence case and save caps for baked images.

### Shape

- Corners are square. The only exception is inline code and badges, which use 3px.
- Rules are 1px at 15–25% opacity. No shadows, blurs, or gradients on UI.
- Spacing sits on an 8px grid, with 4px steps for tight label padding.
- Prefer ruled lists to stacks of cards. Never nest cards.
- Pick one density per surface. Editorial (README banner, social) uses 40–56px padding. Instrument (tools, tables) uses 8–16px padding and 14px text.

### Status

Status is always glyph + word + color.

**Departs from the book.** The book's readouts (`● IN SYNC`, `◆ DOCKING`, `◐ OFFLINE · 3 QUEUED`, `▲ LOS 00:47:12`, `Δ 0`) describe things the API doesn't report: there is no queue count, divergence measure, or signal-loss timer. Use them only in marketing illustrations that are plainly not a real screen. In tools, logs, and docs, the word is the `SyncState` value from `@goodstate/sync-engine`:

| State          | Glyph | Token                      |
| -------------- | ----- | -------------------------- |
| `connected`    | ●     | `--gs-status-connected`    |
| `connecting`   | ◆     | `--gs-status-connecting`   |
| `disconnected` | ◐     | `--gs-status-disconnected` |
| `idle`         | ○     | `--gs-status-idle`         |
| `disposed`     | ■     | `--gs-status-idle`         |
| error          | ×     | `--gs-status-error`        |

`error` is not a `SyncState`. Show it when `onError()` fires, and clear it on the next state change.

On the instrument panel, use the matching `--gs-panel-*` token.

### Icons

Use [Lucide](https://lucide.dev) at 1.5px stroke (`absoluteStrokeWidth`), 16px inline and 20px in cards, colored `--gs-color-label`. Give every icon a text label. Assignments: `IndexDbSync` `hard-drive`, `BroadcastSync` `radio`, `SseSync` `satellite-dish`, browser replica `app-window`, Node.js replica `server`, relay `router`.

## 3. Logo

Goodstate is a wordmark first: "GOODSTATE" in Michroma. Use the supplied artwork and never retype it.

- Clear space: at least the cap height of the G on every side.
- Width: 320px or more preferred, 180px for small uses. Never under 104px on screen or 25mm in print.
- Positive: Martian Night on Sunlight, the default.
- Negative: Sunlight on Martian Night, for code, dark docs, and merchandise.
- Signal: Martian Night on Mars Orange, for launch moments only.
- Don't retype it in another face, recolor it outside the palette, add glows or shadows, or rotate or skew it.

The mission patch is a secondary emblem, for stickers, avatars, and celebrations. Never use it in place of the wordmark. On GitHub, keep it inside the central 80% of the avatar, since GitHub crops avatars to a circle or a rounded square.

## 4. README

The README is the main promotion surface, on GitHub and on npm. Only the branded parts are images. Everything else is real Markdown.

1. Banner: a `<picture>` with light and dark sources, 1672 × 800 exported at 2×. Martian Night with a graded photo, a mono label row (`LOCAL-FIRST STATE FOR TYPESCRIPT`, `● GO FOR LAUNCH`), the wordmark, and "Cleared for offline." Alt text repeats the tagline.
2. Badges from shields.io with `labelColor=1C130C&color=FAF0DE`. Shields.io sets white text on any mid-tone color, and white on Mars Orange is 3.7:1, so badges carry no orange.
3. Intro, quick start, and code in plain Markdown. GitHub's syntax colors are fine.
4. Packages table and examples list in plain Markdown.

Rules:

- Three branded images at most, and never put essential information only in an image.
- Use absolute image URLs (`raw.githubusercontent.com`), because npmjs.com doesn't reliably resolve relative paths or honor `<picture>`. Point them at a release tag, not `main`, so a published version's npm page keeps its images. The light image has to work alone.
- GitHub strips `<style>` and `style` attributes, so bake colors and the image grade into the files.
- Use native `> [!NOTE]` and `> [!WARNING]` callouts.

## 5. Promotion

Release posts, social cards, stickers, and talk slides.

- Release title: version plus one plain headline, optionally with a metaphor ("v1.4.0 — Flight recorder survives schema changes"). Under it, a mono label: `RELEASE · 2026-11-10 · @goodstate/indexdb-sync`. The body keeps the Changesets wording.
- Social card sizes: 1280 × 640 for the GitHub social preview, 1200 × 630 for Open Graph, 1080 × 1080 for square posts.
- Social card layout: Martian Night with a graded photo, a mono label row top-left with status top-right, the wordmark, the tagline in Plex Sans 500, and an install line in Bronze mono (`$ npm i @goodstate/react`). Keep a 64px safe margin. One idea per card, and no code smaller than 24px.
- Sticker: the mission patch, die-cut at 76mm.

### Photos

Photography should look like it was found in a mission archive: grainy, sun-warmed, and full of people doing careful work.

- Warm key light: sodium lamps, sunset, tungsten.
- People at work: hands, checklists, consoles. Competence over spectacle.
- Archive texture: film grain, 1960s–80s hardware, halftone print.
- Avoid neon sci-fi and cyan HUDs, glossy 3D renders, hackers in hoodies, cartoon rockets, cold blue server rooms, galaxies, and starfield wallpaper.

Grade every photo the same way, and bake the grade in for GitHub and social:

1. The image, `object-fit: cover`.
2. `--gs-image-tint` (Mars Orange at 55%) in `color` blend mode.
3. `--gs-image-scrim` wherever text sits on the photo. Sunlight text must reach 4.5:1 against the lightest area behind it.

Every photo is a figure. Caption it bottom-left, 20px in: `FIG. NN — PLACE`, mono, Sunlight on a Night plate at 80% (`--gs-caption-bg`).

Before you publish:

- **Departs from the book.** Name only real places ("MISSION CONTROL, HOUSTON") or describe the subject ("SURFACE OPERATIONS"). The book's "Jamestown" and "Happy Valley, Mars, 1995" come from the TV series _For All Mankind_, so keep them out of public assets.
- Check the license of whatever tool generated the image, and never caption a generated image as a historical photo.
- Never show the NASA insignia or suggest endorsement, and credit "NASA" on NASA images.

## 6. Internal tools

DevTools, example apps, CLIs, and anything else developers use while working with Goodstate. Use instrument density and the semantic tokens.

| Component    | Rules                                                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary      | Mars Orange fill, Martian Night mono label at 12px, 40px min height, hover `--gs-color-accent-hover`. One per view.                                                                                                                                           |
| Secondary    | Transparent with a 1px `--gs-color-border-strong` outline. Hover inverts it.                                                                                                                                                                                  |
| Inputs       | 1px `--gs-color-border-control`. On error, a `--gs-status-error` border and a message below that says how to fix it.                                                                                                                                          |
| Focus        | 2px `--gs-color-focus` outline, 2px offset, on `:focus-visible`.                                                                                                                                                                                              |
| Hover        | A color change only, over `--gs-duration`. No movement or scale.                                                                                                                                                                                              |
| Navigation   | A row of mono labels over a 1px rule, wordmark on the left. The active item gets a 2px Mars Orange bar.                                                                                                                                                       |
| Status chip  | Panel background, mono 12px uppercase, 8 × 12px padding, glyph and word in the panel status color.                                                                                                                                                            |
| Code block   | Always on the panel. Header row: file name as a Bronze mono label, status or "Copy" on the right. Plex Mono 14px, 20px padding, scrolls instead of wrapping. Syntax uses `--gs-syntax-*` only, and anything without its own token uses `--gs-syntax-default`. |
| Table        | Mono uppercase header over a strong rule, hairline rows. Keys in mono, values in sans, numbers right-aligned with `tabular-nums`.                                                                                                                             |
| Outline card | For peers such as sync engines. 1px border, 20px padding. Content order: icon, mono tag, sans 500 title, muted description.                                                                                                                                   |

DevTools and CLI specifics:

- The header shows the replica ID as a mono label, with tabs on the right. The selected tab gets a 2px Mars Orange bottom border.
- The engine list shows the class name (`IndexDbSync`), its status chip, and a "Retry" button that calls `retry()` when it's disconnected.
- The entries table shows the key, the entity kind (`RGA`, `LWWMap`, `LWWRegister`), and the full hybrid logical clock timestamp. Truncate replica IDs in the middle (`3f9c…a21e`).
- Terminal output uses the panel palette, with the status glyph leading each line.
- Never show a number the code doesn't measure.

## 7. Voice

Write like a flight controller on the voice loop: short, exact, and unhurried. Report the state, name the next step, and leave the excitement to the people using what we built.

- Report the state: say what happened and what it means. "SseSync disconnected. Local state is intact. Retry to reconnect."
- One idea per sentence. Real numbers over adjectives. No exclamation marks, no hype.
- Metaphor in moderation: mission language names things and sets the mood, and instructions stay technical. Docs say IndexedDB, not "flight recorder".

| Surface                               | Metaphor                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| README banner, social, release titles | Yes, as the lead                                                                |
| Section intros, figure captions       | Paired with the real term ("Flight recorder — persists the store to IndexedDB") |
| Docs body, API reference              | Once per page, as a gloss                                                       |
| Errors, logs, tool labels, code       | Never. Use the API's names.                                                     |

| Say                                                  | Not                                          |
| ---------------------------------------------------- | -------------------------------------------- |
| Changes made offline merge on reconnect.             | Blazing-fast magic sync 🚀                   |
| Two tabs edited the same list. Both edits were kept. | Conflict detected!! Please resolve manually. |
| v1.0 is out. Godspeed.                               | We're SO excited to finally launch v1!!!     |
| `connected`, `disconnected`, other `SyncState`s      | "online", "live", "in sync" in product UI    |
| "replica", "store", "sync engine", "relay server"    | "node", "peer", "client" used loosely        |
| AOS, LOS, go / no-go, telemetry, flight plan         | Blast off, warp speed, jokes in errors       |

**Departs from the book.** Avoid "nothing is lost" and "never loses data". `LWWRegister` keeps the later of two concurrent writes, so the earlier one is dropped. "Merges without conflicts" is fine, since that's what CRDTs do.

Taglines:

- Primary: "Cleared for offline.", set in Michroma.
- Essence headline: "Loss of signal is not loss of state."
- Alternates, in Plex Sans 500: "State that survives the dark side.", "Every device, one trajectory.", "Good state, godspeed."

Use one per surface.

## 8. Checklist

- Every panel, figure, and photo has a mono label or caption.
- One Mars Orange fill per view, with Martian Night text on it.
- Orange text under 24px on light backgrounds uses `#A3410E`.
- Corners are square, there are no shadows, and rules separate things.
- The logo is the supplied artwork, never retyped.
- Status is glyph + word + color, and outside marketing art it uses `SyncState` names.
- Readouts show only what the code measures.
- Photos are warm-graded hardware and people, never starfields.
- Copy says "merges concurrent changes", not "never loses data".
- Michroma is 32px or larger. Serif is only for real quotes.
- Icons are Lucide, with labels.
