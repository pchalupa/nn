---
author: Petr Chalupa
date: 2026-11-04
---

# Example app specification

This describes what the example apps in `apps/` should do. It's a direction, not a contract. Details can change when there's a good reason, as long as the app keeps its purpose.

## Purpose

The example app is a kanban board that I use to build `nn`. It does two jobs:

1. **A real tool.** I track the work on this project in it, so it has to be good enough to use every day.
2. **The library's demo.** Anyone who opens it should see local-first behavior without reading code. The app keeps working offline, a change in one tab shows up in the other tabs, and edits made on different devices merge into the same board.

It should stay small and easy to maintain. A mobile app and a Next.js app will copy its features later, so each feature should be cheap to build three times.

## Features

### Accounts

- Sign up with a name and a passkey, and sign in with a passkey.
- Several users can exist, so a merge between two people can be shown, even though there's one real user for now.
- An account created on one device can sign in on another device once the data has synced there.
- Sign out.

### Board

- Three columns: **To do**, **In progress** and **Done**.
- Cards show at least the title and the assignee.
- Cards can be reordered within a column and moved between columns.
- The board shows how many tickets there are.

### Tickets

- A ticket has a title, a description, a status and an optional assignee.
- Tickets can be created, opened, edited and deleted.
- An open ticket has its own URL.
- A ticket can have labels, like `bug`, `docs` or a package name. Labels can be added and removed.
- A ticket can have links, like a PR, a commit or an ADR.
- A ticket has comments. Each comment shows its author and when it was written.

### Agents

An agent can use the board as a user. This is a new concept and how it works is still open.

- An agent is a user with a name. It can be an assignee, and its changes and comments show who made them.
- An agent can do what a person can: read the board, create, edit, move and delete tickets, and comment.
- An agent can follow changes as they happen, so it can act on its own, for example when a ticket is assigned to it. What it does is up to the agent and its instructions, not the app.
- An agent's changes merge like any other user's.
- The repo includes a small example agent that shows this working end to end.

### Filters

- The board can be filtered by label and by assignee, for example "assigned to me".
- Filters belong to the device and aren't synced.

## Local-first behavior

- **Offline.** The app works with no network, including after a page reload. Changes made offline reach other devices once the connection is back.
- **Tabs.** A change in one browser tab shows up in other open tabs.
- **Devices.** Changes sync between devices. A new device gets the full board.
- **Merging.** Every device ends up with the same board, whatever order changes arrive in. Concurrent edits to different fields of a ticket are both kept. Concurrent edits to the same field resolve to the later one.
- **Text.** Longer text, like a ticket's description, merges character by character, so two people editing it at the same time both keep their changes.
- **Collections.** Labels added or removed on different devices at the same time are all kept. Comments added offline on different devices all appear, in the same order everywhere.
