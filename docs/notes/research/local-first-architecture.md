# Local-first web architecture: the building blocks, where authority lives, and how real systems choose

Every local-first web app answers the same six questions. Where does the local copy live, and what technology stores it? Who decides the final state: no one, a server, or a database the app already had? What is shipped over the wire: operations, row changes, or whole state? What happens to a local write the server later disagrees with? How do several tabs of the same origin share one database? What happens when the schema changes under a client that has been offline for a month? This note shows how fifteen real systems answer them, using their own docs, code and authors. It then places `@nn` among them.

Researched **2026-11-09**. Every repository was shallow-cloned and read without running any code. Line numbers and symbols refer to the commit given.

**Specifications** (fetched 2026-11-09):

- WHATWG _Storage_, Living Standard, last updated 19 October 2026 ([spec][storage]).
- W3C _Indexed Database API 3.0_, Editor's Draft, 30 October 2026 ([spec][idb]).
- WHATWG _File System_, Living Standard, 19 October 2026 ([spec][fs]).
- W3C _Web Locks API_, Editor's Draft, 9 November 2026 ([spec][locks]).
- WHATWG _HTML_, Living Standard, 9 November 2026: §9.5 _Broadcasting to other browsing contexts_ ([spec][html-bc]) and §10 _Web workers_ ([spec][html-workers]).
- W3C _Service Workers_ Nightly, Editor's Draft, 29 October 2026 ([spec][sw]).
- WICG _Storage Buckets API_, Draft Community Group Report, 19 December 2023 ([spec][buckets]).

**Browser vendor documentation:**

- WebKit, "Updates to Storage Policy" (Sihui Liu, 2023-08-10) ([post][webkit-2023]).
- WebKit, "Full Third-Party Cookie Blocking and More" (John Wilander, 2020-03-24) ([post][webkit-2020]).
- MDN, "Storage quotas and eviction criteria" (last modified 2026-01-05) ([page][mdn-quota]).
- Chrome for Developers, "A change to the default durability mode in IndexedDB" (Thomas Steiner) ([post][chrome-relaxed]).
- Chrome for Developers, "API improvements for working with files in the browser" ([post][chrome-unsafe]).
- SQLite, "Persistent storage options" for SQLite WASM ([page][sqlite-wasm]).

**Systems: code and first-party documentation**

| System                 | Repository @ commit                                                                                                                                                                                                                         | First-party prose read                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Replicache, Zero       | `rocicorp/mono@fbdb27ed5f4ed2b3ae33331ebed5a5033f010dd9` (`packages/replicache`, `zero-client`, `zero-cache`, `zero-protocol`, `zero-server`, `zql`); `rocicorp/zero-docs@22151d4a256ea42b8242ddea8c9810842ba25797`                         | Replicache: [How it works][rep-hiw], [Backend strategies][rep-strat], [Push endpoint reference][rep-push], [replicache.dev][rep-home]                                                                                                                                                                                                                    |
| Linear                 | none (closed source)                                                                                                                                                                                                                        | Peter Travers, "Rebuilding Linear's delta sync read path" (2026-08-18) ([post][lin-delta]); Linear incident post-mortem for 2024-01-24 (2024-01-30) ([post][lin-incident]); Linear docs, "Get the app" ([page][lin-docs]); localfirst.fm #15 with Tuomas Artman, published transcript ([transcript][lin-fm])                                             |
| Figma                  | none (closed source)                                                                                                                                                                                                                        | Evan Wallace, "How Figma's multiplayer technology works" (2019-10-16) ([post][fig-mp]); Wallace, "Rust in production at Figma" (2018-05-02) ([post][fig-rust]); Darren Tsung, "Making multiplayer more reliable" (2022-10-20) ([post][fig-rel]); Arushi Bandi, "Keeping it 100(x) with real-time data at scale" (LiveGraph, 2024-05-17) ([post][fig-lg]) |
| Electric               | `electric-sql/electric@3f9809fb0bd894cb74470d434749673492ad7acf` (docs under `website/docs/sync/`, `packages/typescript-client`)                                                                                                            | James Arthur, "A new approach to building Electric" (2024-07-17) ([post][el-next]); "Local-first with your existing API" (2024-11-21, `website/blog/posts/`)                                                                                                                                                                                             |
| PowerSync              | `powersync-ja/powersync-js@770a4f652361ec59a6a155bd002b67eed07c4728`                                                                                                                                                                        | docs.powersync.com: [client architecture][ps-client], [protocol][ps-proto], [consistency][ps-cons], [writing client changes][ps-write], [handling update conflicts][ps-conflicts], [Sync Streams][ps-streams], [JavaScript Web SDK][ps-web], [schema changes][ps-schema]                                                                                 |
| TanStack DB            | `TanStack/db@a86aa430418572a4834972aa60b7d6a18e2e08ba` (`@tanstack/db` 1.0.0-rc.1.4; docs in the repo may be ahead of tanstack.com)                                                                                                         | in-repo `docs/`                                                                                                                                                                                                                                                                                                                                          |
| Automerge Repo         | `automerge/automerge-repo@6e2101acbf1151cf35d6bd17b7dc61a6384fc828`                                                                                                                                                                         | [Repositories][am-repos], [networking][am-net], [storage][am-storage-doc], [Automerge Repo announcement][am-blog]                                                                                                                                                                                                                                        |
| Yjs providers          | `yjs/y-protocols@73b2ff75486c9879843718dc6c7fc52d63aea4fe`, `yjs/y-websocket@005368cf1915536f11f4411a591fb348a306552f`, `yjs/y-webrtc@c411f1d7223b68f3c6fc9c5901a19819a17db667`, `yjs/y-indexeddb@ff468b5e9cb329165d7db7a9a9c4cf948aee5f5f` | [docs.yjs.dev][yjs-docs], [offline editing][yjs-offline]; Hocuspocus [hooks][hp-hooks]                                                                                                                                                                                                                                                                   |
| Jazz (Classic and 2.0) | `garden-co/classic-jazz@e51832fd1f495a771d89f9c26aa9f6a62c3e0690`, `garden-co/jazz@9762f1018b26f12759b924b6b50565f3e1bd0fb1`                                                                                                                | A. Eickhoff, "What we learned from Classic Jazz" (2026-04-18, in-repo `docs/content/blog/`)                                                                                                                                                                                                                                                              |
| Evolu                  | `evoluhq/evolu@771dc6119aa6cba8325bcde2dddbdd74bc8a2074`                                                                                                                                                                                    | in-repo docs under `apps/web/src/app/(docs)/docs/`                                                                                                                                                                                                                                                                                                       |
| LiveStore              | `livestorejs/livestore@85ddd7c96135761111844f7b35b7ba485f25ff92`                                                                                                                                                                            | in-repo docs under `docs/src/content/docs/`                                                                                                                                                                                                                                                                                                              |
| Triplit                | `aspen-cloud/triplit@d3029ee13e747abeeab8cf5bf64427f77a142e1f` (last commit 2025-09-10)                                                                                                                                                     | in-repo docs under `packages/docs/src/pages/`                                                                                                                                                                                                                                                                                                            |
| InstantDB              | `instantdb/instant@15358ad712df6879b8953ee8289af0e891d4dde8`                                                                                                                                                                                | "A Graph-Based Firebase" (2022-08-25) ([essay][inst-firebase]); "A backend for AI-coded apps" (2026-03-26) ([essay][inst-arch])                                                                                                                                                                                                                          |
| RxDB                   | `pubkey/rxdb@21ce9366ab500a8eb9834db0a0c0d0c5ca045ae7`                                                                                                                                                                                      | [Replication][rx-repl]; in-repo `docs-src/docs/`                                                                                                                                                                                                                                                                                                         |
| TinyBase               | `tinyplex/tinybase@393865864c8ad317971cf6d3ebfd65943830a772`                                                                                                                                                                                | [Using a MergeableStore][tb-merge]; in-repo `site/guides/`                                                                                                                                                                                                                                                                                               |

**Secondary, flagged wherever used:** `wzhudev/reverse-linear-sync-engine@45dc91e78e03300b69cc088057a28c42cee35a41`, a third-party reverse-engineering of Linear's client. Its author says they are not affiliated with Linear (README line 62). It is used in §2.2 only, and only inside a box marked as secondary.

Companion notes in this directory, which this note does not repeat:

- [Local-first software](local-first-software.md): the 2019 essay, the seven ideals, Automerge, Peritext, Cambria, Beelay and Keyhive.
- [CRDT deltas](crdt-deltas.md): Automerge and Yjs sync messages, state vectors, delta-state CRDTs.
- [Persisting CRDT metadata](crdt-metadata-persistence.md): Yjs and Automerge storage layouts, IndexedDB atomicity, the multi-tab lost-update problem.
- [Hybrid Logical Clocks](hybrid-logical-clocks.md): HLC, and Evolu's and Jazz's clock encodings.
- [Array-like CRDTs](array-like-crdts.md), [Map- and object-like CRDTs](map-object-crdts.md), [ID generation](distributed-id-generation.md) and [Keyhive](keyhive.md).
- [Materialized views](materialized-view.md): LiveStore materializers, Electric shapes as views, TanStack DB's differential dataflow.

Section 9 lists what could **not** be verified. Section 8 relates the findings to this repo.

---

## Short answer

**Six layers recur in every system:**

1. A local store.
2. A reactive query layer over that store.
3. Durable persistence underneath.
4. A sync engine that tracks what has and has not been exchanged.
5. A transport.
6. A server role.

The systems differ less in the layers than in two choices: **who has the final word on state**, and **what unit crosses the wire**. Almost everything else follows from those two choices: rebase or no rebase, rollback or no rollback, cursors or version vectors, and how hard schema changes are.

**Five authority models**, each named by its own authors:

1. **No authority; every replica merges.** Automerge Repo, the Yjs providers, TinyBase, Classic Jazz and Evolu.
   - The server is "almost the same code" as a client ([Automerge Repo][am-blog]) or a relay that "cannot read [changes], and … does not decide their order" ([Evolu sync docs][evo-sync]).
   - The price is that authorization has to be built into the data (signatures, keys) or added by a server provider. A device also cannot decide anything that needs global agreement, such as uniqueness or balances. Evolu's docs say so explicitly ([Evolu schema docs][evo-schema]).
2. **Server-authoritative with optimistic local mutations and client-side rebase.** Replicache and Zero ("server reconciliation … pioneered by the video game industry", [Zero sync][zero-sync]), Figma, Linear, InstantDB, Triplit, LiveStore and Jazz 2.0.
   - Local writes are _speculative_ ([Replicache][rep-hiw]). The server orders them and may reject them. The client rewinds to the server state and replays what is still pending.
   - The price is rollback, and with it the loss of what Electric's authors call "finality of local writes" ([Electric Next][el-next]).
3. **Read-path sync from an existing database, with writes through the app's own API.** Electric ("Electric does not do write-path sync", `website/docs/sync/guides/writes.md`) and PowerSync ("server-authoritative reconciliation", [PowerSync][ps-conflicts]).
   - The sync engine replicates Postgres (or another source) out to clients. Writes take a separate path the developer owns.
   - The price is a gap between "applied locally" and "visible in the synced stream". Each system closes it with a different rule: PowerSync does not advance to a new checkpoint while uploads are pending, and TanStack DB waits for a transaction ID to appear in Electric's stream.
4. **Event sourcing with a total-order backend.** LiveStore: "The sync backend acts as the global authority and determines the total order of events" (`syncing.mdx`).
   - This is model 2 with events, not state, as the unit, and with a local database that can always be rebuilt.
5. **Server holds a master copy; clients resolve conflicts.** RxDB's default handler "will always drop the fork state and use the master state" (`replication.md`).

**On the wire,** three shapes appear:

- **Mutations or events**: Replicache push, Zero push, LiveStore events, Linear sync actions.
- **Row-level change logs scoped to a query or partition**: Electric shapes, PowerSync buckets, Zero queries, Triplit and Instant query subscriptions, Linear sync groups.
- **CRDT state or deltas, reconciled by digest**: Yjs state vectors, Automerge heads and Bloom filters, TinyBase hash trees, Evolu range-based set reconciliation.

Every server-mediated system has a **cursor**: a Replicache cookie plus `lastMutationID`, an Electric handle and offset, a PowerSync per-bucket op ID plus checkpoint, a Linear sync-action ID, or an RxDB checkpoint. Each also has a **"throw it all away and refetch"** escape hatch: Electric `409 must-refetch`, a PowerSync checksum failure, a Replicache `onClientStateNotFound`, LiveStore `onBackendIdMismatch`.

**The browser forces most of the remaining choices:**

- Storage is **best-effort and evictable** unless `persist()` is granted ([Storage §7.1][storage]).
- IndexedDB's default durability is "relaxed" in all major browsers ([Chrome][chrome-relaxed]).
- OPFS's fast synchronous handles are **dedicated-worker-only and exclusive** ([File System §2.3.3][fs]). SQLite-on-OPFS therefore needs a worker and a **single owner per database**.
- A single owner across tabs is a **Web Locks** problem. The Web Locks spec uses "a data synchronization service" with a "primary tab" as its motivating example ([Web Locks §1.1][locks]).

So the systems that persist to SQLite in the browser converge on one shape: a lock-elected owner in a worker. Those that persist to IndexedDB often let every tab write and notify each other over BroadcastChannel. Examples:

- LiveStore: leader worker via Web Locks.
- PowerSync: SharedWorker, with a lock-based fallback.
- Evolu: SharedWorker plus an origin-wide lock.
- Jazz 2.0: SharedWorker plus an origin-wide lock that "fails closed".
- RxDB: leader election for replication.
- TanStack DB: Web Locks, then BroadcastChannel.

**Schema evolution** also falls into five approaches:

1. **Make the client schemaless**: PowerSync stores JSON and exposes views.
2. **Rebuild derived state from a durable log**: LiveStore replays its eventlog into a fresh database.
3. **Append-only schemas with quarantine for unknown columns**: Evolu.
4. **Lenses that translate between versions**: Jazz 2.0.
5. **Force the client to update**: Replicache and Zero `onUpdateNeeded` → `location.reload()`; Triplit refuses to connect; Electric `409 must-refetch` on any column change.

**Where `@nn` sits** (§8):

- It is model 1: state-based CRDT roots with LWW and RGA, pushed whole, and a server that stores and fans out without merging.
- Its transport is closest to Replicache's "Reset" strategy: a whole snapshot on every connect.
- Its multi-tab story is "every tab owns everything".
- Compared with the field, the gaps are:
  - no version or cursor on the wire;
  - no partial replication;
  - no authorization on writes;
  - a server copy that can regress, an inference from the code (§8.2);
  - no single storage owner across tabs;
  - no `persist()` request;
  - no schema versioning at all.

---

## 1. The layers, and how each system decomposes them

The six-layer vocabulary below is mine. Each cell is sourced from the system's own documentation or code. "—" means the system has no such layer, or leaves it to the application.

| System            | Local store                                                                                            | Reactivity                                                                    | Browser persistence                                                                                                                 | Sync engine (client)                                                                | Transport                                                        | Server role                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Replicache        | ordered KV "Client View" over a memdag/perdag B-tree ([HIW][rep-hiw]; `src/persist/persist.ts`)        | `subscribe()` re-runs when touched keys change (`src/replicache.ts` L392–410) | IndexedDB (`kv/idb-store.ts`), memory fallback on failure (`storage-failure.ts`)                                                    | push/pull with pending-mutation rebase                                              | app-defined HTTP push/pull plus optional poke                    | app's own backend implements push and pull                                                                   |
| Zero              | normalized client datastore (`zero-docs/introduction.mdx` L5), wraps `ReplicacheImpl` (`zero.ts` L716) | incremental view maintenance (`packages/zql/src/ivm/`)                        | IndexedDB, `mem` fallback (`zero.ts` L559–567; `connection.mdx` L258)                                                               | query-driven sync, poke-carried patches                                             | WebSocket (`zero.ts` `createSocket`)                             | `zero-cache`: SQLite replica fed by Postgres logical replication, plus CVRs in Postgres (`zero-config.ts`)   |
| Linear            | "Each client maintains a local database" ([delta sync][lin-delta])                                     | not documented first-party                                                    | not documented first-party                                                                                                          | delta sync from a checkpoint ([delta sync][lin-delta])                              | not documented first-party                                       | per-workspace ordered sync-action log; "Postgres remains the authoritative source" ([delta sync][lin-delta]) |
| Figma (documents) | full document copy downloaded on open ([Wallace 2019][fig-mp])                                         | —                                                                             | not documented                                                                                                                      | property-level last-writer-wins, unacked-change masking                             | WebSocket ([Wallace 2019][fig-mp])                               | one process per document (Rust child process, [Wallace 2018][fig-rust]), authoritative                       |
| Electric          | none in the TS client; `Shape` keeps `.rows` in memory (`typescript-client/src/shape.ts`)              | `Shape` subscribers                                                           | browser HTTP cache by default (`api/http.md` "Caching in the browser")                                                              | shape log consumer with handle and offset                                           | HTTP long-poll or SSE (`api/http.md`)                            | Electric service: Postgres logical replication into on-disk shape logs (`guides/shapes.md`)                  |
| PowerSync         | SQLite with JSON `ps_data__*` tables plus views ([client architecture][ps-client])                     | watch queries                                                                 | wa-sqlite: IndexedDB VFS by default; OPFS VFSes optional (`resolveAndValidateOptions.ts`; `vfs.ts`)                                 | logic in the SQLite core extension (`powersync_control`)                            | HTTP streaming (default on web) or WebSocket ([web SDK][ps-web]) | PowerSync Service replicates the source DB into buckets; "responsible for the _read path_"                   |
| TanStack DB       | collections (synced data plus optimistic overlay) (`docs/overview.md`)                                 | live queries via d2ts differential dataflow (`overview.md`)                   | optional: wa-sqlite on OPFS (`guides/sqlite-persistence.md`)                                                                        | delegated to the collection adapter (Electric, PowerSync, Query, RxDB, …)           | adapter's                                                        | adapter's                                                                                                    |
| Automerge Repo    | Automerge documents behind `DocHandle`s                                                                | `DocHandle` events; framework bindings in separate packages                   | one `StorageAdapterInterface` (range-queryable KV); IndexedDB adapter (`automerge-repo-storage-indexeddb`)                          | per-document `DocSynchronizer` under a `CollectionSynchronizer`                     | pluggable: WebSocket, MessageChannel, BroadcastChannel           | another Repo with FS storage and `sharePolicy: async () => false` (`examples/sync-server/index.js`)          |
| Yjs + providers   | `Y.Doc`                                                                                                | Yjs observers                                                                 | `y-indexeddb`, one per document name                                                                                                | provider per document or room; SyncStep1/2 handshake (`y-protocols/PROTOCOL.md` §3) | WebSocket, WebRTC, BroadcastChannel                              | y-websocket server or Hocuspocus; none for y-webrtc                                                          |
| Classic Jazz      | CoValues (signed, encrypted per group)                                                                 | subscriptions                                                                 | IndexedDB (`cojson-storage-indexeddb`)                                                                                              | LOAD/KNOWN/CONTENT/DONE per CoValue (`docs/sync-protocol.md`)                       | WebSocket                                                        | sync server is a `LocalNode` with SQLite; peers verify signatures themselves                                 |
| Jazz 2.0          | relational database in a Wasm engine                                                                   | query subscriptions                                                           | SQLite stored in IndexedDB, owned by a SharedWorker (`reference/internals.mdx`)                                                     | query-driven                                                                        | —                                                                | "Core owns the authoritative database" (`how-sync-works.mdx`)                                                |
| Evolu             | SQLite (Kysely queries)                                                                                | `subscribeQuery`; worker sends patches per query (`Evolu.ts`)                 | own SQLite-WASM in an OPFS SyncAccessHandle pool, page-encrypted (`packages/web/src/Sqlite.ts`)                                     | range-based set reconciliation per owner (`Protocol.ts`)                            | WebSocket to relays                                              | relay stores ciphertext; "cannot read them, and it does not decide their order" ([sync docs][evo-sync])      |
| LiveStore         | eventlog plus SQLite state built by materializers                                                      | signals graph "built on the ideas of Adapton" (`design-decisions.md`)         | OPFS only, via wa-sqlite AccessHandlePool (`web-adapter.mdx`)                                                                       | push/pull of events with client-side rebase (`syncstate.ts`)                        | provider-specific (Cloudflare, Electric, S2)                     | stores events, "enforcing the total event order" (`how-livestore-works.mdx`)                                 |
| Triplit           | client DB over a local cache plus outbox                                                               | query subscriptions                                                           | memory by default, IndexedDB optional; "does not currently provide a Sqlite storage adapter for the browser" (`client/storage.mdx`) | per-query subscriptions with timestamp checkpoints                                  | WebSocket                                                        | stamps writes with the server HLC (`server-core/src/sync-connection.ts`)                                     |
| InstantDB         | triple store plus Datalog engine (InstaQL)                                                             | query results recomputed client-side                                          | IndexedDB (`IndexedDBStorage.ts`); SQLite rejected as "too heavy" ([architecture][inst-arch])                                       | "Reactor" state machine; pending queue                                              | WebSocket                                                        | Postgres as multi-tenant triple store; WAL-tailing invalidator ([architecture][inst-arch])                   |
| RxDB              | NoSQL document collections                                                                             | RxJS observables                                                              | swappable RxStorage: LocalStorage (default), Dexie/IndexedDB, OPFS and others                                                       | fork/master replication with checkpoints (`replication.md`)                         | app-defined pull and push handlers, optional stream              | any backend that meets the data-layout rules; "the backend can be 'dumb'"                                    |
| TinyBase          | in-memory Store or MergeableStore                                                                      | listeners                                                                     | persisters: Local/Session storage, IndexedDB, OPFS, SqliteWasm                                                                      | synchronizer with hash-tree diffing (`src/synchronizers/index.ts`)                  | WebSocket, BroadcastChannel, local                               | "a relatively 'thin server'" that routes messages (`2_using_a_synchronizer.md`)                              |

Four observations follow from the table.

### 1.1 The "local store" and "persistence" layers separate in three ways

1. **Store is persistence.** In PowerSync, LiveStore, Evolu and Jazz 2.0, a SQLite engine in Wasm is both the query engine and the durable store.
   - LiveStore keeps two copies of SQLite: "in-memory SQLite for sub-millisecond queries and persistent SQLite for durable storage" (`how-livestore-works.mdx`).
2. **An in-memory structure is checkpointed to IndexedDB.** Replicache (memdag over perdag), Automerge Repo, Yjs, InstantDB, Triplit and RxDB all work this way.
3. **No durable client store at all.** The Electric TS client relies on the HTTP cache and leaves materialisation to the developer: "Syncing into a database is out of scope of this guide" (`guides/client-development.md`). TanStack DB's SQLite persistence is optional.
   - Electric explicitly frames the HTTP cache as enough for offline reads: it "can make data access instant and available offline, even without using a persistent local store" (`api/http.md`).

### 1.2 Reactivity sits above the store in every system

Every system implements its own reactive layer rather than relying on the database to push notifications:

- key-tracking: Replicache;
- incremental view maintenance: Zero, TanStack DB;
- signals: LiveStore;
- observables: RxDB;
- per-query patches from a worker: Evolu.

The materialized-view framing of this layer is covered in [Materialized views](materialized-view.md) §5.

### 1.3 The server role ranges from a router to the database itself

From least to most server responsibility:

1. **Router**: TinyBase ("does not need to store data of its own").
2. **Ciphertext relay**: Evolu.
3. **Peer with storage**: Automerge Repo, Classic Jazz.
4. **Sequencer**: LiveStore.
5. **Replicator of an existing database**: Electric, PowerSync, `zero-cache`.
6. **Application backend that executes mutations**: Replicache push endpoint, Zero custom mutators, PowerSync `uploadData` target.
7. **The database of record**: Jazz 2.0 "Core", InstantDB, Figma's multiplayer process, Linear's Postgres.

### 1.4 Some products keep two sync layers for two kinds of data

- **Figma** keeps document data in its multiplayer system. Comments, users, teams and projects are "stored in Postgres, not our multiplayer system … because of different tradeoffs around … performance, offline availability, and security" ([Wallace 2019][fig-mp]).
- Figma later built **LiveGraph** for the second kind: "a web API for subscribing to GraphQL-like queries" fed from the Postgres replication stream ([LiveGraph][fig-lg]).
- **Yjs** separates the CRDT document from **awareness**, a second, ephemeral state-based CRDT. "Awareness information isn't stored in the Yjs document, as it doesn't need to be persisted across sessions" ([Yjs awareness][yjs-awareness]; `y-protocols/PROTOCOL.md` §4).
- **Automerge Repo** has the same split: `DocHandle.broadcast()` and `Presence` (`src/presence/Presence.ts`).

---

## 2. Where authority lives

### 2.1 No authority: every replica merges

**Automerge Repo.**

- The sync server "runs almost the same code as above, but with a different network and storage adapter" ([announcement][am-blog]).
- The reference server differs from a client only in configuration. It uses `sharePolicy: async () => false`, with the comment "Since this is a server, we don't share generously — meaning we only sync documents they already know about and can ask for by ID" (`examples/sync-server/index.js`).
- Peers are not authenticated. The WebSocket client sends a `join` message with a self-asserted `peerId`, and the server emits `peer-candidate` with no verification (`automerge-repo-network-websocket/src/messages.ts`, `JoinMessage`).
- The announcement lists authentication, authorization and end-to-end encryption among the things it has no "turnkey solutions" for ([announcement][am-blog]).
- **Inference, not an author statement:** `access` share policy plus the requirement that a peer ask for a document by ID means a document URL works as a read capability (`DocSynchronizer.ts` `#mayReceive`).

**Yjs.**

- "Yjs doesn't need a central source of truth" ([docs.yjs.dev][yjs-docs]).
- Authority depends on the provider:
  - y-websocket "implements a classical client server model" and is "a solid choice if you want a central source that handles authentication and authorization" (`y-websocket/README.md`).
  - y-webrtc offers "Encryption and authorization over untrusted signaling servers", with room passwords run through PBKDF2 into AES-GCM keys (`y-webrtc/src/crypto.js` `deriveKey`).
- The core protocol has no notion of a read-only peer. "Yjs has no built-in concept of read-only peers; a server MAY enforce it by inspecting the first two bytes" of a message. "Awareness payloads are not authenticated" (`y-protocols/PROTOCOL.md` §6).
- Write authorization exists only where a server adds it. For example, Hocuspocus's `connection.readOnly` means "changes will not be accepted and synced to other clients" ([Hocuspocus hooks][hp-hooks]).

**TinyBase.**

- `MergeableStore` gives each update "a timestamp, based on a hybrid logical clock (HLC), and a hash". The resulting "'last write wins' (LWW) approach allows the MergeableStore to act as a … CRDT" ([MergeableStore guide][tb-merge]).
- The WebSocket server "does not need to store data of its own" but routes and broadcasts.
- "WsServer and WsServerSimple do not authenticate or authorize channel Ids" (`2_using_a_synchronizer.md`).

**Classic Jazz** puts authority into the data itself.

- "All transactions are signed with your account's signing keypair … Whether transactions are valid depends on your permissions in the Group that owns the CoValue" (classic-jazz `homepage/…/reference/encryption.mdx`).
- Every peer computes validity in `determineValidTransactions` (`packages/cojson/src/permissions.ts`).
- Read access is a group key that rotates when a member is removed. Removed members "can't read new data, but existing data they already had access to remains readable" (same docs).
- **Jazz's own authors have since moved away from this design.** The 2026 retrospective says teams "did not love the public-key complexity, the unusual permission APIs, or the fact that permission mistakes were hard to evolve … some useful permission rules still wanted at least a semi-trusted authority". Jazz 2.0 "lean[s] into the Jazz server as a trusted authority" (`jazz/docs/content/blog/what-we-learned-from-classic-jazz.mdx` L27–30).
- `garden-co/jazz` main is now Jazz 2.0, a server-authoritative relational database (§2.2). The CoValue design lives on in `garden-co/classic-jazz`. Thesis text that describes "Jazz" as CoValues is describing Classic Jazz.

**Evolu.**

- "Evolu has no authoritative server … A relay stores the encrypted changes … It cannot read them, and it does not decide their order" ([sync docs][evo-sync]).
- Write authorization is a **write key** derived from the owner secret, "a token relays check before accepting changes; it controls who can write, not who can read" ([privacy docs][evo-privacy]).
- The stated trade-offs (same page, "Write keys"):
  - "a write key can't be rotated yet, and a leaked one can't be revoked";
  - removing a collaborator means moving the data to a new owner;
  - a reader of a shared read-only owner holds the encryption key and can therefore produce valid changes.
- Evolu's schema docs draw the boundary of what a device can decide alone. Uniqueness, balances and similar decisions need someone to "Let one place decide, such as a server", and Evolu rejects unique indexes for that reason ([schema docs][evo-schema], "Uniqueness").
- Keyhive's approach to the same problem is in [Keyhive](keyhive.md).

### 2.2 Server-authoritative, optimistic local mutations, client rebase

**Replicache.**

- "In Replicache, the server is authoritative." Client mutations are "_speculative_ until applied on the server" ([How it works][rep-hiw], "Speculative Execution and Confirmation").
- Conflict resolution is whatever the developer's mutator does on the server. "The potential for merge conflicts is unavoidable in a system like Replicache" (same page, "Conflict Resolution").
- Replicache is now "in maintenance mode", and "Existing users should migrate to Zero" ([replicache.dev][rep-home]).

**Zero** is Replicache's successor ("Replicache (2020) - The predecessor to Zero", `zero-docs/contents/docs/sync.mdx` L79).

- It states its position more bluntly than any other system: "Zero is not local-first. It's a client-server system with an authoritative server." "Zero doesn't support offline writes" (`when-to-use.mdx` L38–42).
- The rationale names the problems every system in this section has to solve: "Supporting offline writes in collaborative applications is inherently difficult, and no sync engine or CRDT algorithm can automatically solve it for you" (`connection.mdx` L312).
- The listed failure modes (L320–322):
  - foreign keys, constraints and authorization rules "can pass while offline, but break when the user reconnects";
  - "The application's schema can change while offline".
- "the cost to support offline is extremely high. There is simply more value in making the online experience great first" (L337).
- Reads keep working offline. Writes are rejected in the `disconnected`, `error` and `needs-auth` states (L130–140).

**Figma** names the trade-off against CRDTs directly.

- "Figma isn't using true CRDTs though. CRDTs are designed for decentralized systems where there is no single central authority … Since Figma is centralized (our server is the central authority), we can simplify our system by removing this extra overhead" ([Wallace 2019][fig-mp]).
- The server keeps the latest value per property, "similar to a last-writer-wins register … except we don't need a timestamp because the server can define the order of events".
- The accepted cost: "simultaneous editing of the same text value doesn't work in Figma".
- Offline is handled by refetch-and-replay. "When you come back online, the client downloads a fresh copy of the document, reapplies any offline edits on top" (same post).
- Since 2022, a DynamoDB journal assigns each change "a sequence number", and checkpoints go to S3 "every 30 to 60 seconds" ([Tsung 2022][fig-rel]).

**Linear** calls itself local-first and server-authoritative in the same post.

- "Linear is a local-first application. Each client maintains a local database … the tradeoff is that a client returning online needs a way to catch up, fast" ([delta sync][lin-delta]).
- "the read path treats Postgres as the final authority for the most recent actions" (same post).
- Its user docs are explicit about the limits of offline writes: "Offline mode is designed as a failsafe and not a full-fledged feature." Linear does not check each change's creation date before applying it, so heavy offline editing could "overwrite changes from someone on your team" ([Linear docs][lin-docs]).

> **SECONDARY: Linear client internals.** These are not confirmed by any first-party source I could read. The reverse-engineering at `wzhudev/reverse-linear-sync-engine@45dc91e` describes:
>
> - MobX-observable models loaded from IndexedDB into an object pool (README L72–80);
> - `full`, `local` and `partial` bootstraps keyed on `lastSyncId` (L538–552);
> - write transactions queued in an IndexedDB `__transactions` table and completed when the matching `lastSyncId` arrives in a WebSocket delta (L1012–1035, L1246–1285);
> - last-writer-wins rebase in `UpdateTransaction.rebase` (L1446–1478);
> - `__schemaHash`-driven IndexedDB migration (L327–335).
>
> The README header quotes Tuomas Artman calling it "pretty awesome (and correct)", but that endorsement is itself relayed by the third party. None of these claims are used elsewhere in this note.

**InstantDB.**

- InstantDB argues for last-write-wins on product grounds: "Notion, Figma, and Linear all use last-write-wins … I think last-write-wins is a great 80/20" ([A Graph-Based Firebase][inst-firebase], "80/20 for Multiplayer" and footnote 28).
- Its triple model makes conflicts attribute-level: "Since they are different rows, there's no conflict" (same).

**Triplit.**

- Triplit markets "Collaboration/Multiplayer powered by CRDTs" (README).
- The code shows a server-assigned order. `handleChangesMessage` stamps each incoming client batch with the server's HLC (`this.db.clock.next()`) and acknowledges with that timestamp (`packages/server-core/src/sync-connection.ts`).
- The entity store applies only changes newer than what it holds (`packages/db/src/entity-metadata-store.ts`).

**Jazz 2.0.**

- "Core owns the authoritative database. A write first updates the app's local state … Core … checks permissions and either accepts or rejects it" (`jazz/docs/content/docs/recipes/local-first/how-sync-works.mdx`).
- Conflicts are settled by arrival order: "the edit it receives first wins and the other is kept in history as a lost edit. Device clocks play no part" (same, L121).

### 2.3 Read-path sync from an existing database

**Electric.**

- "Electric Sync is a read-path sync engine for Postgres" (`website/docs/sync/index.md`).
- "Electric does not do write-path sync. It doesn't provide (or prescribe) a built-in solution for getting data back into Postgres from local apps and services" (`guides/writes.md` L31–33).
- The 2024 rewrite was a deliberate retreat from an earlier design ([Electric Next][el-next]):
  - The earlier system's "key differentiator" was "finality of local-writes", meaning "writes are final, not tentative. I.e.: once a write is accepted locally, it won't be rejected as invalid later on."
  - "We still believe that a local-first stack that provides finality of local writes can provide a better DX and UX … However, it is no longer a key tenet of the system design."
  - Authorization moved out: "A sync engine may provide some hooks and options but should not prescribe a solution" (scope table).

**PowerSync.**

- "The developer's app backend therefore dictates how mutations from clients are processed … This is known as server-authoritative reconciliation" ([update conflicts][ps-conflicts]).
- The PowerSync Service is "responsible for the _read path_" ([service architecture][ps-service]).
- The stated reason: "so that you can apply your own backend business logic, validations and authorization to any mutations" ([client architecture][ps-client]).

### 2.4 Event sourcing with a total-order backend

LiveStore syncs events, and the backend orders them.

- "The sync backend acts as the global authority and determines the total order of events ('causality')" (`building-with-livestore/syncing.mdx`).
- Its trade-offs section reads, in full: "Require a central sync backend to enforce a global total order of events. This means LiveStore can't be used in a fully decentralized/P2P manner. Do rebasing on the client side (instead of on the sync backend). This allows the user to have more control over the rebase process" (`syncing.mdx` L172–176).
- **The docs contradict each other on conflict handling:**
  - `how-livestore-works.mdx` says LiveStore "defaults to a 'last-write-wins' strategy";
  - `syncing.mdx` says "Merge conflict handling isn't implemented yet";
  - `design-decisions.md` describes "deterministic total-order rebase".

### 2.5 Server holds a master copy; clients resolve conflicts

RxDB keeps an authoritative "master" state on the server but resolves conflicts on the client: "RxDB resolves all conflicts on the client" (`docs-src/docs/replication.md`, "Conflict handling").

- The default handler's rationale: "The default conflict handler will always drop the fork state and use the master state. This ensures that clients that are offline for a very long time, do not accidentally overwrite other peoples changes" (same).
- In code: `resolve(i) { return i.realMasterState; }` (`src/replication-protocol/default-conflict-handler.ts`).
- RxDB also refuses to trust client clocks: "client side clocks can never be trusted … the backend should overwrite the `updatedAt` timestamp" (`replication.md`, "Security").

### 2.6 What the authority choice decides

All of the following are consequences that the sources state, not opinions.

| If authority is…                 | then local writes are…                                                           | authorization on writes is…                                                                                                                                                                                                                                                                                                                                  | the system can enforce global invariants?                                               |
| -------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| nobody (CRDT merge)              | final; never rolled back                                                         | data-level: Classic Jazz signatures and group keys, Evolu write keys; or absent: Automerge Repo, TinyBase                                                                                                                                                                                                                                                    | no: "Let one place decide, such as a server" ([Evolu schema][evo-schema])               |
| a server (mutations, rebase)     | speculative; can be rolled back ([Replicache][rep-hiw]; Zero `mutators.mdx` L53) | ordinary server code. Zero: "Because mutators are just normal TypeScript functions that run server-side, there is no need for a special permissions system" (`mutators.mdx` L1187). Triplit: "Access control checks run exclusively on the server … Invalid writes will only be rejected when they have been sent to the server" (`schemas/permissions.mdx`) | yes, at the cost of offline writes being provisional. Zero does not support them at all |
| an existing database (read-path) | provisional until they appear in the synced stream                               | the app's own API ([Electric][el-next]; [PowerSync][ps-client])                                                                                                                                                                                                                                                                                              | yes, in the app backend                                                                 |
| a total-order event backend      | provisional; rebased                                                             | app hooks on push and pull; LiveStore "doesn't include built-in authentication or authorization support" (`patterns/auth.mdx`)                                                                                                                                                                                                                               | only what the backend's ordering plus app validation can express                        |

---

## 3. Sync protocol shapes

### 3.1 The unit on the wire

**Mutations or events (operation-based).**

- **Replicache push**: `{pushVersion, schemaVersion, profileID, clientGroupID, mutations}`, where each mutation is `{id, name, args, timestamp, clientID}`. These are named mutator invocations, not state (`packages/replicache/src/sync/push.ts` L36–70).
- **Zero push**: the same idea over WebSocket (`packages/zero-protocol/src/push.ts`).
- **LiveStore events**: each carries `seqNum`, `parentSeqNum`, `name` and `args` (`syncing.mdx` "Events").
- **Linear sync actions**: each has "an ordered ID, the affected model, the type of change, routing metadata, and the data a client must apply", in "an application-level log … higher than the Postgres write-ahead log" ([delta sync][lin-delta]).
  - The 2024 post-mortem describes a sync packet as "the type of action taken (insert, update, archive, delete), a snapshot of the entire entity after the change, and a delta of properties changed" ([incident][lin-incident]).

**Row or entity change logs (server to client).**

- **Electric's Shape Log** is "a log of logical database operations … similar conceptually to the logical replication stream from Postgres … It's then the responsibility of the client to consume the log and materialize out the current value" (`api/http.md` "Shape Log").
- **PowerSync buckets** hold ordered `PUT` and `REMOVE` operations. "a row is only deleted from the client if it has been removed from _all_ buckets" ([protocol][ps-proto]).
- **Replicache pull** returns a `patch: PatchOperation[]` of state changes plus `lastMutationIDChanges` (`packages/replicache/src/puller.ts` L42–48). The push side is operation-based and the pull side is state-based.
- **Zero pokes** carry `rowsPatch`, `lastMutationIDChanges` and query patches (`packages/zero-protocol/src/poke.ts` L34–109).

**CRDT state or deltas, reconciled by digest.**

- **Yjs**: state vector, then missing updates (`y-protocols/PROTOCOL.md` §3). In detail in [CRDT deltas](crdt-deltas.md) §5.
- **Automerge**: heads and Bloom filter. In detail in [CRDT deltas](crdt-deltas.md) §3.
- **TinyBase**: hash-tree descent. `GetContentHashes`, then `GetTableDiff`/`GetRowDiff`/`GetCellDiff`, descending table → row → cell only where hashes differ (`src/synchronizers/index.ts` `getChangesFromOtherStore`).
- **Evolu**: "Range-Based Set Reconciliation … similar to Negentropy", per owner (`packages/common/src/local-first/Protocol.ts` module doc).
  - Evolu says what this costs the app: "Sync doesn't replay a log … changes arrive in any order … Apps therefore see rows that are incomplete or missing for a while" ([sync docs][evo-sync]).

**Document state with a server-side diff.**

- **RxDB push** sends `assumedMasterState` plus `newForkState` per document. The handler "must return … the master document states of all conflicts" (`replication.md`, transfer level).

### 3.2 Push, pull and poke

- **Replicache**
  - Pull runs on an interval (60 s by default, `replicache-options.ts` `pullInterval`).
  - A **poke** is "a contentless hint … that they should pull" ([How it works][rep-hiw]).
- **Zero** collapses poke and pull. Its pokes carry the data: `pokeStart`, `pokePart`, `pokeEnd` (`poke.ts`).
- **Electric** uses plain HTTP: `GET /v1/shape` with `live=true` long-polling, or `live_sse=true` (`api/http.md`).
  - The rationale is "minimises state … integrates with standard HTTP tooling, including proxies and CDNs" ([Electric Next][el-next]).
  - CDN request collapsing is presented as the way to serve "millions of concurrent clients with minimal load on the sync service and no load on the source Postgres" (`api/http.md` "Collapsing live requests").
- **PowerSync** streams a sequence: "Checkpoint available" (with per-bucket checksums), then data, then "Checkpoint complete" ([protocol][ps-proto]).
- **LiveStore**: "Upstream events always need to be pulled before a client can push" (`syncing.mdx`). This is git's rule, and `ServerAheadError` enforces it (`common/src/sync/errors.ts`).
- **RxDB** separates "Checkpoint iteration", used for the initial load and after reconnect, from "Event observation", used live. A stream should emit `RESYNC` on reconnect (`replication.md`).

### 3.3 Cursors and versions

Every system that syncs through a server keeps a server-issued cursor. None of them uses vector clocks for that purpose.

| System     | Cursor                                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Replicache | **cookie**, "a value opaque to the client identifying the canonical server state that the client has", plus per-client `lastMutationID` ([How it works][rep-hiw])                             |
| Zero       | `baseCookie`/`cookie` on pokes; CVRs in Postgres "determine the diff to send on reconnect" (`zero-config.ts` L536–542)                                                                        |
| Electric   | `electric-handle` ("an ephemeral identifier to an existing shape log") plus `electric-offset` (`guides/client-development.md`)                                                                |
| PowerSync  | per-bucket last op ID, plus checkpoints with checksums ([protocol][ps-proto])                                                                                                                 |
| Linear     | "the client sends a checkpoint containing the ID of the last change it applied" ([delta sync][lin-delta])                                                                                     |
| LiveStore  | event sequence number; a `backendId` that detects a backend reset (`syncing.mdx`)                                                                                                             |
| RxDB       | opaque checkpoint per replication; server documents must be "deterministically sortable by their last write time" and "never deleted, instead the `_deleted` field is set" (`replication.md`) |
| Triplit    | `latest_server_timestamp` per query (`client/src/sync-engine.ts` `connectQuery`)                                                                                                              |
| InstantDB  | `processed-tx-id` (`Reactor.js`)                                                                                                                                                              |
| Figma      | per-file sequence number; clients "can skip re-downloading the file if they have it locally with the same sequence number" ([Tsung 2022][fig-rel])                                            |

Peer systems have no single cursor. Their sync state is "what each side has": Yjs state vectors, Automerge heads, TinyBase hashes, Evolu ranges, and Classic Jazz "header + session transaction counts" in `KNOWN` messages (`classic-jazz/docs/sync-protocol.md`).

### 3.4 Partial replication

**Two families**, server-side partitions and query subscriptions:

- **Electric shapes.**
  - A shape is one table plus a `where` clause and `columns`.
  - Shapes are "currently immutable … If you want to change the data in a shape, you need to start a new subscription" (`guides/shapes.md`).
- **PowerSync buckets and Sync Streams.**
  - "Buckets are scoped by their parameters … always synced as a whole" ([protocol][ps-proto]).
  - "A stream creates one bucket for each unique value of its filter" ([Sync Streams][ps-streams]).
  - Parameters come from the client subscription, from the JWT (signed, "secure and tamper-proof"), or from the connection.
- **Zero queries.**
  - The client names a query. `zero-cache` asks the app's `queries` endpoint for the ZQL, runs it against its replica and streams row changes (`zero-docs/queries.mdx` L46–56).
  - Zero "syncs the _union_ of all active queries' results" (L1181).
  - Queries live on a TTL (5 minutes by default) because "Zero queries are not free" (L955–1062).
- **Linear**: "sync groups encode access to parts of a workspace, and sync subscriptions narrow that further to the models and views the client currently needs" ([delta sync][lin-delta]).
- **Triplit**: clients "request the latest data from the server only for those queries that they are subscribed to and have permission to view … the server … will send only the attribute-level changes that the client has not yet seen" (`offline-mode.mdx`).
- **InstantDB**: `add-query` subscriptions. The offline cache keeps 10 query subscriptions by default (`queryCacheLimit`, `docs/init/page.md`).
- **Jazz 2.0**: "The set of active queries on a client defines the rows it can see" (`how-sync-works.mdx`).

**Documents as the unit:**

- **Automerge Repo** syncs per document. `ShareConfig { announce, access }` decides whether a peer is told about a document and whether it may fetch it (`src/Repo.ts`). The default "is to share all documents with all peers" (README).
- **Yjs** syncs per room.
- **Classic Jazz** syncs per CoValue. Missing dependencies, such as groups and accounts, are fetched with follow-up `LOAD`s (`sync-protocol.md`).
- **Evolu** syncs per owner. `ShardOwner` exists to partition data "so it can be synced independently" (`Owner.ts`).

**No partial replication:**

- **LiveStore**: "LiveStore assumes a 1:1 mapping between an eventlog and a SQLite database" (`syncing.mdx` "Partitioning"). `storeId` is the partition.
- **TinyBase**: only the room path.

**Partial replication costs something. Authors who state the cost:**

- RxDB: "The server must support scoped queries … Checkpoint storage grows … Cleanup is explicit" (`partial-sync.md`).
- Replicache rates partial sync as "Difficult" under its Global Version strategy, and calls Row Version "the most flexible and powerful strategy, but also the hardest to implement" ([strategies][rep-strat]).
- Electric and PowerSync both scope partial replication by the auth context:
  - In Electric, a proxy "must set server-side" `table`, `where` and the secret. Subset queries are ANDed, so they "can only narrow results, never widen them" (`guides/auth.md` L320–340).
  - PowerSync puts parameters in the JWT.

### 3.5 Initial load, resumption and the reset escape hatch

**Initial load.** Initial load is the same mechanism as catch-up in most designs:

- **Electric**: `offset=-1` makes "Electric quer[y] Postgres for the data and populate[] the log by turning the query results into insert operations". The client pages until `up-to-date` (`api/http.md`).
- **PowerSync**: "The same process covers initial download, offline catch-up and live streaming" ([protocol][ps-proto]).
- **Replicache's "Reset" strategy** is the degenerate case: "Each pull computes and retransmits the entire client view" ([strategies][rep-strat]).
- **Zero** hydrates twice. It runs the query against local data first ("client hydration") and then applies the server result ("server hydration") (`queries.mdx` L38–48).
- **Linear**: large permission changes should not "force clients into a full bootstrap" ([delta sync][lin-delta]). The wording implies a full-bootstrap path separate from delta sync.

**Consistency during load:**

- PowerSync: "The client only updates its local state when it has all the data matching a checkpoint … There is no intermediate state" ([consistency][ps-cons]).
- Electric: clients should "Only apply logical operations … when you get an `up-to-date` message" (`guides/client-development.md` "Transactions").

**The reset escape hatch.** Every server-mediated system can tell a client to discard its state and start over:

- **Electric `409` / `must-refetch`**: "the client must throw away their local shape data and re-sync from scratch" (`api/http.md`). It is triggered by a replication-slot change, a schema change, LRU shape eviction or a manual delete (`guides/shapes.md` L548–589). In code, `ShapeStream#requestShape` handles 409 by marking the handle expired and resetting (`typescript-client/src/client.ts` L1083–1110).
- **PowerSync**: a checksum mismatch makes the client "delete the bucket and start a new sync session" ([protocol][ps-proto]).
- **Replicache**:
  - `onClientStateNotFound` fires when the client has been garbage-collected (`replicache.ts` L183–188).
  - `clientMaxAgeMs`, 24 hours by default, is "the maximum time a tab can be in the background … and still be able to sync" (`replicache-options.ts` L228).
- **LiveStore**: `onBackendIdMismatch: 'reset' | 'shutdown' | 'ignore'` (`syncing.mdx`).
- **Figma**: on reconnect the client always downloads a fresh copy and replays ([Wallace 2019][fig-mp]).

**Compaction** is unfinished in several systems:

- Electric: "We plan to implement compaction" (`guides/deployment.md` L164).
- LiveStore: compaction is "not implemented yet" (`syncing.mdx`).
- PowerSync compacts buckets by replacing stale operations with markers "while keeping the same checksums" ([protocol][ps-proto]).

---

## 4. Writes and conflicts at the architecture level

### 4.1 Where pending writes live, and how they are reconciled

| System              | Pending-write store                                                                                             | Reconciliation when the server's state arrives                                                                                                                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Replicache          | local commits above the sync head                                                                               | **rebase**: rewind to the server snapshot, apply the patch, replay pending mutations with `mutationID > lastMutationID`, then "atomically reveal[]" the result ([How it works][rep-hiw]; `src/sync/pull.ts` L303, L353–394)                                                                  |
| Zero                | same mechanism                                                                                                  | "Any pending mutations which have been applied to the server have their local effects rolled back" (`mutators.mdx` L53)                                                                                                                                                                      |
| Figma               | unacknowledged property changes                                                                                 | **mask**: "discard incoming changes from the server that conflict with unacknowledged property changes" ([Wallace 2019][fig-mp])                                                                                                                                                             |
| InstantDB           | separate pending queue, persisted under `pendingMutations` (`Reactor.js`)                                       | **overlay**: "we don't apply it directly to the Triple store. Instead we track the change in a separate queue … If the server returns a failure, we simply remove the change" ([architecture][inst-arch]); re-applied while `tx-id > processedTxId` (`Reactor.js` `_applyOptimisticUpdates`) |
| TanStack DB         | `optimisticUpserts`/`optimisticDeletes` alongside `syncedData` (`packages/db/src/collection/state.ts` L161–179) | **overlay**: "a local view that overlays the optimistic mutations on top of the immutable synced data … If the handler throws an error, the optimistic state is rolled back" (`docs/overview.md`)                                                                                            |
| Electric (patterns) | none built in; four documented patterns (`guides/writes.md`)                                                    | from online-only to "through-the-DB" shadow tables; "Seperating immutable synced state from mutable local state also makes it easy to reason about and implement rollback strategies. Worst case, you can always just wipe the local state and/or re-sync"                                   |
| PowerSync           | `ps_crud` upload queue, "a blocking FIFO queue" ([consistency][ps-cons])                                        | **hold**: "While mutations are present in the upload queue, the client does not advance to a new checkpoint. This means the client never has to resolve conflicts locally" ([consistency][ps-cons]; `SqliteBucketStorage.updateLocalTarget`)                                                 |
| LiveStore           | pending events in the eventlog                                                                                  | **rebase** events onto upstream; `merge()` returns advance, rebase or reject (`common/src/sync/syncstate.ts`)                                                                                                                                                                                |
| Triplit             | outbox, implemented as a KV double buffer (`packages/db/src/entity-store-with-outbox.ts`)                       | applied with the server's timestamp on `CHANGES_ACK`; on rejection, `onFailureToSyncWrites` fires and the app clears pending changes. No automatic rollback (`client/event-listeners.mdx`)                                                                                                   |
| RxDB                | none needed; the local document is the fork                                                                     | client-side conflict handler with master and fork states (§2.5); failed pushes are retried, so "The remote instance must be designed to handle … duplicate data transmissions" (`replication.md`)                                                                                            |
| Linear              | "the app will store changes locally and re-try … even if you restart the application" ([Linear docs][lin-docs]) | not documented first-party (see the secondary box in §2.2)                                                                                                                                                                                                                                   |
| CRDT systems        | none                                                                                                            | **merge**: local writes are applied and kept; nothing is rolled back                                                                                                                                                                                                                         |

The table shows four reconciliation strategies: **rebase**, **overlay**, **hold**, and **mask**.

- **Rebase and overlay** produce the same visible result. They differ in whether pending writes are replayed into the base store (Replicache, LiveStore) or kept beside it (TanStack DB, InstantDB). The overlay makes rollback a deletion.
- **Hold** (PowerSync) avoids rebase entirely by freezing the synced view while uploads are pending.
- **Mask** (Figma) is the cheapest. It only works because the unit of conflict is a single property under last-writer-wins.

### 4.2 Making the write path idempotent and ordered

Server-authoritative systems all solve "at-least-once delivery" in the same way: **a per-client monotonic mutation ID stored transactionally with the effect**.

- **Replicache.**
  - "All mutations with IDs less than or equal to the client's current lastMutationID must be ignored."
  - The update to `lastMutationID` must commit "as part of the same transaction" as the mutation.
  - An invalid mutation must still be marked as processed. "Otherwise, the client will keep trying to send the mutation and be blocked forever" ([push reference][rep-push]).
- **Zero** throws `OutOfOrderMutation` when a received ID is ahead of the expected one (`packages/zero-server/src/process-mutations.ts` L799–824).
- **PowerSync** tells developers to make operations idempotent and **not** to answer a bad write with an error status: "avoid returning an error response (4xx) … the client SDK retries the upload indefinitely, which blocks the upload queue. Instead, return a 2xx" ([writing client changes][ps-write]).
  - The write endpoint must also be synchronous with the source database, or "those changes will be removed from the client … UI glitches" ([writing client changes][ps-write]).
- **TanStack DB's durable outbox**: "The server must accept the same idempotency key on repeated requests" (`docs/guides/offline-transactions.md`).

**Bridging the read-path gap.** When writes go through an API and reads come from a replication stream, the client needs to know when its write has come back. Two mechanisms are documented:

- **TanStack DB with Electric**: "the backend returns a txid, and the client waits for that specific txid to appear in the Electric stream". `pg_current_xact_id()` must be read "inside the same transaction as your mutation" (`docs/collections/electric-collection.md` L63–103, L500–540).
- **PowerSync's write checkpoint**: the server tracks the CDC position (LSN, resume token or GTID) "and notifies the client when the data has been replicated" ([protocol][ps-proto]). The client requests the checkpoint only after `ps_crud` is empty, and discards it if new uploads arrived in the meantime (`SqliteBucketStorage.ts` L60–100).

### 4.3 Server-side mutators

**Zero** and **Replicache** run the same named mutator on both sides.

- "A copy of each mutator exists on both the client and on your server … the implementations don't have to be the same, or even compute the same result" (`zero-docs/mutators.mdx` L34–43).
- The server version is the authority. The client version is a prediction.
- This is how Zero answers authorization: the server mutator is ordinary code with the session's user in scope (`mutators.mdx` L1187).
- Replicache's equivalent rule: the server should verify "that the clientID passed in the PushRequest in fact belongs to that user" ([push reference][rep-push]).

---

## 5. Web platform constraints

### 5.1 Storage engines

**IndexedDB.**

- **Transactions.** Transactions isolate concurrent clients: "A single database can be used by multiple clients (pages and workers) simultaneously — transactions ensure they don't clash while reading and writing" ([IndexedDB §1][idb]).
- **Schema upgrades.** Changing the set of object stores requires an **upgrade transaction**:
  - "The upgradeneeded event isn't fired, and thus the upgrade transaction isn't started, until all other connections to the same database are closed" ([IndexedDB §2.7.3][idb]).
  - Old tabs must react to `versionchange` and close their connection. Otherwise the new tab sees `blocked` (same spec, §1 example).
  - The consequence for schema evolution is spelled out in §6.
- **Durability.**
  - Each transaction has a durability hint: `"strict"`, `"relaxed"` or `"default"`. In a typical implementation, `"strict"` means flushing OS buffers "before a complete event is fired" ([IndexedDB §2.7][idb]).
  - Chrome changed the default for read-write transactions "from `strict` to `relaxed` from Chrome 121", "to align with other major browsers which all use `relaxed`". Relaxed "issues the `complete` event after changes make it to the OS buffer" ([Chrome][chrome-relaxed]).
  - So `oncomplete` is not proof of a disk write. This is the same caveat as in [Persisting CRDT metadata](crdt-metadata-persistence.md) §4.

**OPFS** (the "bucket file system").

- It is reached through `navigator.storage.getDirectory()`. Its contents are not meant to be user-visible ([File System §3][fs]).
- `createSyncAccessHandle()` is `[Exposed=DedicatedWorker]`. It "takes an exclusive lock on the file entry", and "offers synchronous methods. This allows for higher performance on contexts where asynchronous operations come with high overhead, e.g., WebAssembly" ([File System §2.3.3][fs]).
- Two consequences follow, and every SQLite-in-browser system designs around both:
  1. The fast path needs a **dedicated worker**.
  2. **Only one handle can hold a file at a time.**
- Chrome has trialled a `mode: "readwrite-unsafe"` option that allows multiple writers ([Chrome][chrome-unsafe]). It does not appear in the File System Standard as fetched on 2026-11-09. PowerSync's `SimpleOpfsVFS` uses it on Chromium, combined with `navigator.locks` (`packages/web/src/db/adapters/wa-sqlite/vfs.ts` L33–55).

**SQLite-WASM.** The official build documents the trade-off ([SQLite persistence][sqlite-wasm]):

- The `"opfs"` VFS "is only available when sqlite3.js is loaded from a Worker thread". It requires `SharedArrayBuffer`, and therefore the COOP and COEP headers.
- Because of sync access handles, "no two database handles can have the same OPFS-hosted database open at one time". A second tab "will hit a locking error". Even reads lock, so "there's no such thing as 'N concurrent readers'".
- `"opfs-sahpool"` needs no COOP/COEP and is "Easily the highest OPFS performance". But "initializing it twice, e.g. via two tabs to the same origin, will fail for the second and subsequent instances".

**What the systems chose:**

- **LiveStore**: OPFS only, through an AccessHandlePool VFS in wa-sqlite (`web-adapter.mdx`). It falls back to memory in Safari and Firefox private mode.
- **Evolu**: its own SQLite-WASM in an `opfs-sahpool`-format pool. "the caller must serialize opens of a directory, as Evolu does with its leader Web Lock" (`packages/sqlite-wasm/src/SahPool.ts`).
- **PowerSync** defaults to `IDBBatchAtomicVFS`, SQLite over IndexedDB. OPFS VFSes are optional and "require dedicated workers" (`resolveAndValidateOptions.ts`).
- **Jazz 2.0**: SQLite stored in IndexedDB, inside a SharedWorker (`reference/internals.mdx`).
- **InstantDB** rejected SQLite as "too heavy … about 300 KB gzipped" in favour of IndexedDB ([architecture][inst-arch]).
- **Triplit** "does not currently provide a Sqlite storage adapter for the browser" (`client/storage.mdx`).
- **RxDB**: OPFS sync handles are "only available inside of a WebWorker … cannot be used in the main thread, an iFrame or even a SharedWorker" (`rx-storage-opfs.md`). Its OPFS and IndexedDB storages are paid "Premium" plugins.

### 5.2 Quotas, eviction and `persist()`

**The Storage Standard model.**

- Data lives in a **storage bucket** whose mode is `"best-effort"` or `"persistent"`. It is initially best-effort ([Storage §4.5][storage]).
- Under storage pressure the user agent "should clear network state and local storage buckets whose mode is 'best-effort'". Persistent buckets may be cleared only after informing the user ([Storage §7.1][storage]).
- "Whenever a storage bucket is cleared by the user agent, it must be cleared in its entirety" (§7). A local-first app loses all of its local data at once, never part of it.
- `navigator.storage.persist()` requests the `"persistent-storage"` permission and, if granted, flips the bucket to persistent (§8).
- Quota is "an implementation-defined conservative estimate", and "must not be a function of the available storage space on the device" (§6).

**What browsers do:**

| Browser           | Per-origin quota                                                                                                                                                          | `persist()` decision                                                                                           | Eviction                                                                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chromium          | "up to 60% of the total disk size in both persistent and best-effort modes" ([MDN][mdn-quota])                                                                            | automatic, "based on the user's history of interaction with the site", no prompt ([MDN][mdn-quota])            | LRU by origin, skipping persisted origins ([MDN][mdn-quota])                                                                                                                                                                                                                        |
| Firefox           | best-effort: the smaller of 10% of disk or a 10 GiB group limit; persistent: up to 50% of disk, capped at 8 TiB ([MDN][mdn-quota])                                        | "the user is notified with a UI popup" ([MDN][mdn-quota])                                                      | LRU by origin ([MDN][mdn-quota])                                                                                                                                                                                                                                                    |
| Safari and WebKit | browser app: up to 60% of disk per origin, 80% overall; other apps embedding WebKit: 15% and 20%; Home Screen web apps get the browser quota ([WebKit 2023][webkit-2023]) | "based on heuristics like whether the website is opened as a Home Screen Web App" ([WebKit 2023][webkit-2023]) | origin-based LRU; persisted origins and origins with an active page may be excluded ([WebKit 2023][webkit-2023]). With tracking prevention on, script-written storage is deleted after "seven days of Safari use without user interaction on the site" ([WebKit 2020][webkit-2020]) |

On the seven-day rule, WebKit says that Home Screen web apps "are not part of Safari and thus have their own counter of days of use", and that the authors "do not expect the first-party in such a web application to have its website data deleted" ([WebKit 2020][webkit-2020]). MDN's page does not repeat that exemption.

**Which systems call `persist()`:**

- **Evolu** calls it automatically. "After the first local mutation of a database the browser stores, this tab asks the browser once with `navigator.storage.persist()`" (`packages/web/src/local-first/Evolu.ts` `createEvoluDeps`).
- **Jazz 2.0** documents the trade-off and tells apps to call it themselves "once after the user has signed in or interacted enough" (`setup/web-client/local-first-client.mdx`).
- No `persist()` call was found in Automerge Repo, the Yjs providers, Replicache or Zero (grep, §9).
- Replicache and Zero handle storage failure instead. `StorageFailureKind = 'full' | 'cannot-open' | 'io-error'` falls back to memory "for the rest of the session" (`storage-failure.ts`; `zero-docs/connection.mdx` L260–272).

**Storage Buckets API.** The draft lets an origin create named buckets, each with its own `persisted`, `quota` and `expires` ([Storage Buckets][buckets]). That would allow separating "synced, re-fetchable" data from "pending, irreplaceable" writes. It is a Community Group draft, and no system surveyed uses it.

### 5.3 Multi-tab coordination

**The four primitives:**

- **BroadcastChannel** ([HTML §9.5][html-bc]).
  - It delivers a structured-clone message to other `BroadcastChannel` objects with the same name and storage key, but **not to the sender**, and not to documents that are not fully active.
  - Delivery order is defined only among channels in the same agent.
  - The spec recommends it for simple cases. For "elaborate cases, e.g. to manage locking of shared state, to manage synchronization of resources between a server and multiple local clients, to share a WebSocket connection with a remote host … shared workers are the most appropriate solution".
- **SharedWorker** ([HTML §10][html-workers]).
  - One worker serves all same-origin clients that construct it with the same URL and name.
  - The browser-compatibility data embedded in the spec marks **Chrome for Android: No**.
- **Web Locks** ([Web Locks][locks]).
  - Named exclusive or shared locks, coordinated across all agents that share a storage bucket.
  - When a document unloads or an agent terminates, its locks are released.
  - The spec's own use cases are local-first:
    - "A web-based document editor stores state in memory for fast access and persists changes … to a storage API such as the Indexed Database API for resiliency and offline use, and to a server for cross-device use. When the same document is opened for editing in two tabs the work must be coordinated across tabs, such as allowing only one tab to make changes to or synchronize the document at a time."
    - "In a data synchronization service, a 'primary tab' is designated. This tab is the only one that should be performing some operations (e.g. network sync, cleaning up queued data, etc). It holds a lock and never releases it. Other tabs can attempt to acquire the lock … If the 'primary tab' crashes or is closed then one of the other tabs will get the lock and become the new primary" (§1.1).
  - `ifAvailable` and `steal` exist for non-blocking probes and recovery from a hung holder.
- **IndexedDB itself**: transactions serialize readers and writers, and `versionchange` tells old tabs to close (§5.1).

**What each system does:**

| System         | Pattern                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Replicache     | every tab is a client in a **client group** sharing one IndexedDB cache; "Changes made by one client are visible to other clients, even while offline" ([How it works][rep-hiw]). BroadcastChannels (`replicache-on-persist:<name>`, `replicache-new-client-group-v1:<name>`) notify, and `MutationRecovery` pushes mutations other groups left behind. No Web Locks found (`src/on-persist-channel.ts`, `src/new-client-channel.ts`, `src/mutation-recovery.ts`)                                                                                                     |
| Zero           | client groups per user; `ActiveClientsManager` holds one exclusive Web Lock per client plus a BroadcastChannel to track live tabs (`zero-client/src/client/active-clients-manager.ts` L47–71). Each tab appears to open its own socket (§9). Hidden tabs disconnect after 5 minutes (`options.ts` L293–301)                                                                                                                                                                                                                                                           |
| LiveStore      | **leader election by Web Lock** (`livestore-tab-lock-${storeId}`). The leader is a dedicated worker that is the single writer, "needed for synchronous OPFS API which isn't supported in a shared worker". A SharedWorker "mostly acts as a proxy" (`web-adapter.mdx`; `adapter-web/src/web-worker/client-session/persisted-adapter.ts`). Android Chrome has no SharedWorker, so "Multi-tab synchronization is not available". The design note: "Multi-tab consistency becomes a leader-election problem instead of a write-conflict problem" (`design-decisions.md`) |
| PowerSync      | a **SharedWorker** connects "on behalf of all tabs. It calls the `fetchCredentials` and `uploadData` methods of the most recently opened tab" ([web SDK][ps-web]). Without SharedWorker, "Only one tab connects and syncs at a time", using a navigator lock plus BroadcastChannels (`TabLocalStreamingSyncImplementation.ts`). Multi-tab is **off by default on Android, iOS and Safari** (`resolveAndValidateOptions.ts` L24–31)                                                                                                                                    |
| Evolu          | one SharedWorker per build. It "takes an origin-wide lock before it answers any tab", so a worker from an older deploy waits. Tabs elect which one hosts the dedicated DbWorker that owns OPFS SQLite. A tab entering the back/forward cache "ends its part as if it closed". A one-tab SharedWorker polyfill covers browsers without SharedWorker (`packages/common/src/local-first/Shared.ts`)                                                                                                                                                                      |
| Jazz 2.0       | "one directly durable SharedWorker runtime per database namespace … There is no tab-leader election … one origin-wide Web Lock per physical database namespace … fails closed instead of risking two durable owners" (`reference/internals.mdx` L255–259)                                                                                                                                                                                                                                                                                                             |
| Classic Jazz   | each tab claims its own session with `navigator.locks.request("load_session_${sessionID}")`. A crashed session with unpersisted transactions is not reused, because "reusing it could fork the session's hash chain on the server" (`BrowserSessionProvider.ts`)                                                                                                                                                                                                                                                                                                      |
| RxDB           | `multiInstance` shares events between instances. The leader-election plugin makes sure "only exactly one runs the replication", "implemented via the broadcast-channel module". RxDB warns that "On rare occasions … more than one leader is elected" (`replication.md`; `leader-election.md`)                                                                                                                                                                                                                                                                        |
| TanStack DB    | the offline outbox: "One tab leads outbox processing … prefers Web Locks and then BroadcastChannel" (`offline-transactions.md`; `OfflineExecutor.ts` L198–212). SQLite persistence "elects an owner for each Collection and routes writes between tabs" (`sqlite-persistence.md`)                                                                                                                                                                                                                                                                                     |
| Triplit        | `WorkerClient` in a SharedWorker, so "data syncs between browser tabs without having to sync with server" (`client/web-worker-client.mdx`)                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Automerge Repo | the IndexedDB adapter "is safe for concurrent use so you can have multiple tabs pointing at the same storage" ([storage docs][am-storage-doc]). The BroadcastChannel adapter is self-described as "a bit of a hack … quite inefficient", and recommends MessageChannel instead. The example puts storage and the WebSocket in a SharedWorker so that "tabs themselves are stateless … only ever create one websocket connection … only do our writes in one place (no race conditions)" (`examples/react-counter/src/main.tsx`)                                       |
| Yjs            | every tab keeps its own `Y.Doc` and IndexedDB provider. y-websocket exchanges updates "via cross-tab communication (Broadcast Channel and localStorage as fallback)" (`y-websocket/README.md`)                                                                                                                                                                                                                                                                                                                                                                        |
| TinyBase       | `BroadcastChannelSynchronizer`, for example between a UI store and a Service Worker store persisted to IndexedDB (`2_using_a_synchronizer.md`)                                                                                                                                                                                                                                                                                                                                                                                                                        |
| InstantDB      | a `BroadcastChannel('@instantdb')` that the code read uses only for `auth` messages (`Reactor.js`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Electric       | no multi-tab coordination found in the TS client (§9)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**The pattern.**

- Systems whose store is **mergeable or append-only in IndexedDB** let every tab write and notify each other over BroadcastChannel: Replicache, Automerge Repo, Yjs.
- Systems whose store is **SQLite on OPFS, or a single sync connection with a pending-upload queue**, need one owner and elect it with **Web Locks**, usually inside a worker: LiveStore, PowerSync, Evolu, Jazz 2.0, RxDB replication, TanStack's outbox.
- Mobile Chrome's lack of SharedWorker makes "SharedWorker plus fallback" mandatory. LiveStore degrades to single-tab, PowerSync to a lock-elected tab, and Evolu to a polyfill.

### 5.4 Workers and service workers

**Workers.** Dedicated workers are needed for OPFS sync handles (§5.1). Every SQLite-backed system therefore runs its database off the main thread: PowerSync `useWebWorker: true` by default, LiveStore's leader worker, Evolu's DbWorker, and the Jazz 2.0 SharedWorker.

**Service workers.** These are a different tool.

- They are "generic, event-driven, time-limited script contexts". The spec warns that the user agent "may terminate service workers at any time" when there is no event to handle ([Service Workers §1, §2.1.1][sw]). They are therefore not a home for a long-lived sync connection.
- What they do provide is the **offline app shell**. The spec offers "a request and response store similar in design to the HTTP cache, which makes it easier to build offline-enabled web applications" (§Abstract).
  - Its caches "do not get updated unless authors explicitly request them to be … authors should version their caches by name and make sure to use the caches only from the version of the service worker that can safely operate on" (§5.2).
- A new service worker waits until all clients of the old one are gone, unless it calls `skipWaiting()`, which lets it "progress from the registration's waiting position to active even while service worker clients are using the registration" (§4.1.4).
- For local-first apps this is the code-versus-data version problem in miniature. An old tab can keep running old code against a database that a new tab has migrated. This is exactly what Evolu's per-build SharedWorker lock and Replicache's `replicache-new-client-group` channel guard against (§5.3, §6).
- No system surveyed runs its sync engine in a service worker. TinyBase's guide uses one as a persistence host behind a BroadcastChannel synchronizer.

---

## 6. Schema evolution on clients that may be offline for a long time

The authors are unusually frank about this problem:

- **Zero**: "The application's schema can change while offline" is one of its two reasons not to support offline writes (`connection.mdx` L320–322).
- **RxDB**: "Clients can only migrate when the new code was updated … This could be today or in a few weeks" (`downsides-of-offline-first.md`).
- **Classic Jazz**: "Once you've published a schema, you should only ever add fields … you have no way of ensuring that a new schema is distributed to all clients, especially if you're building a local-first app" (classic-jazz `schemas/accounts-and-migrations.mdx`).
- **Automerge Repo** has no schema or migration facility in any package (grep, §9). Its announcement lists schema changes as unsolved ([announcement][am-blog]). Cambria's lens approach is covered in [Local-first software](local-first-software.md) §8.

The systems fall into five strategies.

1. **Force the client to update.**
   - **Replicache** includes `schemaVersion` in every push and pull, and in the IndexedDB name (`rep:${name}:${formatVersion}:${schemaVersion}`, `src/make-idb-name.ts`). A new version therefore starts a fresh local database.
   - Replicache's server can answer `VersionNotSupported`, which triggers `onUpdateNeeded`. The default handler calls `location.reload()` (`src/error-responses.ts`; `replicache.ts` L233–250).
   - **Zero** does the same on connect (`SchemaVersionNotSupported`). It prescribes expand/contract ordering: "Deploy providers before consumers. DB → API → Client" to expand, and "Client → API → DB" to contract (`schema.mdx` L389–392, L449–462).
   - **Triplit**: "If the schemas are incompatible, the client will refuse to connect". Only adding optional attributes or collections is backwards-compatible. The remedies for durable offline caches are listed with the comment "None of these are ideal solutions" (`schemas/updating.mdx`).
   - **Electric**: any column add, drop or rename "automatically invalidates all shapes on that table". Clients get `409 must-refetch` and re-sync from scratch (`guides/shapes.md` "Schema changes").
2. **Make the client schemaless.**
   - **PowerSync**: "The client-side schema is just a view on top of the schemaless data … no client-side migrations required."
   - Unknown tables and columns are kept but hidden. Type mismatches are handled with SQLite `CAST`. "Nothing in PowerSync will fail hard if there are incompatible schema changes" ([schema changes][ps-schema]).
   - The protocol itself "is schemaless" ([protocol][ps-proto]).
   - The cost moves to the developer, who must keep server-side changes backwards-compatible, for example with versioned streams.
3. **Rebuild derived state from a durable log.**
   - **LiveStore**: "A schema change opens a fresh state database and replays the full eventlog … The eventlog and pending events are preserved" (`state/sqlite-schema.mdx`).
   - The constraint moves to the events. "Event definitions can't be removed … can be evolved as long as the changes are forward-compatible" (`events.mdx`).
   - An older client that receives a newer event chooses `unknownEventHandling: 'warn' | 'ignore' | 'fail' | 'callback'` (`patterns/app-evolution.mdx`).
   - The design notes give the motivation directly: "Frustration with database schema migrations → event sourcing" (`design-decisions.md`).
4. **Append-only schemas, plus quarantine.**
   - **Evolu**: "app schemas are append-only … Do not rename or remove tables/columns … Do not change column types". Every app column is nullable in queries.
   - Changes for columns an older app does not yet know go to a **quarantine table**. They "still sync" and are applied once the app updates ([schema docs][evo-schema], "Versioning").
   - Of all the approaches here, this is the only one that lets an old client relay data written by a newer one without losing it.
5. **Lenses or per-version translation.**
   - **Jazz 2.0**: "Jazz keeps every schema version usable and translates rows between them on read and write … nothing on disk is rewritten". This lets it "Accept writes from clients that have been offline since before the new schema landed" (`schemas/migrations.mdx`).
   - Not yet supported: type changes, optional-to-required, and moving data between tables. The workaround is "expand and contract over two releases".
   - **RxDB** sits between strategies 1 and 5. Integer schema `version`s with per-version `migrationStrategies` rewrite local documents and the replication's `assumedMasterState`. However, "RxDB assumes that you run the exact same migration on the servers and the clients … the replication `pull-checkpoint` will not be migrated. Your backend must be compatible with pull-checkpoints of older versions" (`migration-schema.md`).

**Other systems:**

- **Figma**'s data model sidesteps most of this. Documents are `Map<ObjectID, Map<Property, Value>>`, and "adding new features to Figma usually just means adding new properties to objects" ([Wallace 2019][fig-mp]).
- **TinyBase** coerces rather than migrates. Unknown values are ignored and missing ones defaulted (`05_schemas/1_using_schemas.md`).
- **InstantDB** migrates server-side with `instant-cli push schema`. On the client, `_rewriteMutations` remaps pending mutations to new attribute IDs (`Reactor.js`).

**The browser constraint.** On top of the server schema there is the **local storage schema**. Changing IndexedDB object stores needs an upgrade transaction that waits for every other connection to close (§5.1). Old tabs on old code must therefore cooperate, by closing on `versionchange`, or the upgrade is `blocked`.

---

## 7. Cross-cutting findings

These are patterns across the sources. Each one rests on the citations in §§1–6.

1. **Most systems are server-authoritative, and the authors who chose it explain why.**
   - Figma "simplif[ied] our system by removing this extra overhead".
   - Zero says CRDTs do not solve offline writes "despite what their marketing says".
   - Electric dropped finality of local writes as "a key tenet".
   - Jazz moved from signed CoValues to a server "trusted authority".
   - Linear and InstantDB accept last-writer-wins.
   - Only Evolu, TinyBase, Automerge Repo and Yjs remain without an authority. Of these, Evolu documents most precisely what that rules out.
2. **There is always a cursor and always a reset.** Every server-mediated design has an opaque server-issued position and a "throw it away and refetch" path (§3.3, §3.5). Peer designs replace the cursor with a digest exchange.
3. **Optimistic state is kept apart from confirmed state.**
   - Rebase (Replicache, LiveStore), overlay (TanStack DB, InstantDB) and hold (PowerSync) all keep a clean separation between what the server has confirmed and what is still pending.
   - Electric's guide states the benefit: separating them "makes it easy to reason about and implement rollback strategies. Worst case, you can always just wipe the local state and/or re-sync".
4. **Delivery is at-least-once, with idempotent receivers.** A per-client mutation ID committed with the effect (Replicache, Zero, PowerSync, TanStack's idempotency key) is how these systems make retries safe.
5. **Partial replication is defined by the auth context.** Shapes behind a proxy, PowerSync parameters from the JWT, Zero queries resolved by the app's endpoint, and Linear sync groups all scope what a client may sync by who it is, decided on the server.
6. **The browser forces a single owner.** OPFS's exclusive sync handles and the cost of N sync connections push SQLite-based systems to a Web-Lock-elected owner in a worker. The Web Locks spec already describes this pattern ("primary tab"). Missing SharedWorker on Chrome for Android forces a fallback path in every system that relies on it.
7. **Eviction is all-or-nothing and best-effort by default.** Few systems handle it. Evolu calls `persist()`, Jazz 2.0 documents it, and Replicache and Zero detect a storage failure and fall back to memory.
8. **Schema evolution is the least solved layer.** The five strategies in §6 trade developer discipline (append-only, backwards-compatible changes) against user disruption (forced reloads, full refetch). Only log-based systems (LiveStore) and lens-based ones (Jazz 2.0, Cambria) let an old client's offline writes survive a breaking change without the app code reconciling them by hand.

---

## 8. Where `@nn` sits, and the gaps this exposes

Everything in this section was read from the working tree at `5031df0` (2026-11-09). Claims about the example server are about `apps/example-react/api/_server`, which is example code, not a published package.

### 8.1 Layer mapping

| Layer       | `@nn` today                                                                                                                                                                                                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local store | [`Store`][nn-store] and [`State`][nn-state]: a schema-typed tree of state-based CRDT entities ([`LWWRegister`][nn-register], `LWWMap`, `RGA`), stamped with the HLC in [`@nn/time`][nn-time]                                                                                                                           |
| Reactivity  | `View` caches a frozen projection per entity `revision` ([`projectors/view.ts`][nn-view]); [`@nn/react`][nn-react] binds it with `useSyncExternalStoreWithSelector`. Full recomputation on invalidation; see [Materialized views](materialized-view.md) §6                                                             |
| Persistence | [`IndexDbSync`][nn-idbsync]: one IndexedDB object store per top-level field, holding a whole encoded root, written with `put` and resolved on `oncomplete` ([`index-db.ts`][nn-idb]). Persistence is "just another sync engine" ([ADR-14][adr14])                                                                      |
| Sync engine | abstract [`SyncEngine`][nn-engine] with `open`/`close`/`pull`/`push`, a five-state [`Session`][nn-session] ([ADR-16][adr16], [ADR-17][adr17]) and listener methods ([ADR-18][adr18])                                                                                                                                   |
| Transport   | [`SseSync`][nn-sse] (`EventSource` on `/subscribe`, `POST /push`) and [`BroadcastSync`][nn-bc] for tabs ([ADR-15][adr15])                                                                                                                                                                                              |
| Server role | example server: `POST /push` does `Object.assign` (memory) or `HSET` (Redis) and publishes to an event bus; `GET /subscribe` registers for the bus, sends the whole stored map as the first event, then each push ([`routes/sync.ts`][nn-server]; [`memory-database.ts`][nn-memdb]; [`redis-database.ts`][nn-redisdb]) |
| App shell   | example app registers a Workbox service worker via `vite-plugin-pwa` with `registerType: "autoUpdate"` ([`vite.config.ts`][nn-vite])                                                                                                                                                                                   |

### 8.2 Classification against §§2–6

**Authority: model 1, no authority, with a non-merging server.**

- Entities merge on every client ([`state.ts`][nn-state] `merge`), so local writes are final and never rolled back. This is the "finality of local writes" that Electric's authors gave up ([Electric Next][el-next]).
- The server does not merge. [ADR-15][adr15] says so: "The example server stores each field as it arrives and doesn't merge. Clients converge because each one merges what it receives and pushes its own changes again."
- Among the surveyed systems, the closest analogues are:
  - **TinyBase**: a state-based LWW CRDT with a thin routing server.
  - **Evolu**: a relay that does not decide order.
- Evolu's relay **stores every change**. Automerge Repo's server **merges**. `@nn`'s example server **replaces** each root field with the last one pushed.

**Inference from the code; not tested.** Because the server replaces rather than joins, its stored copy equals whichever push of a field arrived **last**, not the join of all pushes.

Most races heal themselves:

- A client that receives a newer published state merges it.
- If the merge changes its state, `store.onChange` fires and [`SyncEngine`][nn-engine] pushes the merged root again.

The case that does not heal is two pushes of the same field arriving out of order:

```text
Tab A edits field X twice in quick succession → pushes s1, then s2 (s2 ⊇ s1).
ADR-16: "Each change pushes the changed field right away, even while an
earlier push of the same field is pending." Two POSTs are in flight.
s2 arrives first: the server stores s2 and publishes it.
s1 arrives second: the server stores s1, replacing s2, and publishes it.
Every client merges s1 and nothing changes, because s1 ⊆ s2. Nobody re-pushes.
The server holds s1 until the next edit to X. A client bootstrapping now gets s1.
```

Merging is monotonic, so no connected client loses data. Only the server's copy and new bootstraps are affected.

The IndexedDB engine guards against the same race locally. `IndexDb.set` aborts the pending transaction for a field before writing the new one ([`index-db.ts`][nn-idb]). The HTTP push path has no equivalent: no per-field sequencing in `SseSync`, and no version check on the server.

None of the surveyed server-mediated systems are exposed to this, for two different reasons:

- Some make the server the authority, with per-client mutation IDs that reject out-of-order delivery (§4.2): Replicache, Zero, PowerSync, Electric.
- Others make the server a merging peer or an append-only log: Automerge Repo, Classic Jazz, LiveStore, Evolu.

None of the surveyed server-mediated systems have this property, for two different reasons:

- Some make the server the authority, so the server's copy is the truth: Replicache, Zero, PowerSync, Electric.
- Others make it a merging peer or an append-only log: Automerge Repo, Classic Jazz, LiveStore, Evolu.

**Wire unit: CRDT state, whole root per push.**

- [`Store.onChange`][nn-store] reports changed top-level fields already encoded. `SyncEngine.send` pushes each one whole.
- On connect, every field is pushed again ([ADR-16][adr16]). Each edit to one ticket therefore re-sends the whole `tickets` RGA, including its tombstones.
- This is the state-based end of the spectrum in [CRDT deltas](crdt-deltas.md) §6. Nothing in the surveyed set ships whole state per edit except Replicache's "Reset" pull strategy, and that applies to pull only ([strategies][rep-strat]).

**Cursors and resume: none.**

- Every reconnect gets the full snapshot as the first SSE event. [ADR-15][adr15] rejected `Last-Event-ID` resume "because the server stores only current values, not a history of updates".
- That matches Replicache's Reset strategy and Figma's "downloads a fresh copy" on reconnect. ADR-15 already notes that "a server with larger data would need resume support".

**Pending writes: none, by design.**

- [ADR-16][adr16] and [ADR-17][adr17] replace an outbox with "every connection pushes every field". That is sound for a state-based CRDT: re-sending current state subsumes all earlier sends.
- It costs O(state) per reconnect, where queue-based systems pay O(pending writes).
- It also means no write is ever rejected. There is no path for a server to say no (see authorization below).

**Partial replication: none.**

- One store maps to one server key (`nn-example` in the Redis adapter). Every client receives every field.
- Compared with §3.4, there is no equivalent of shapes, buckets, queries or Evolu's owners.

**Authorization: none on reads or writes.**

- `POST /push` accepts any object of fields, and `GET /subscribe` returns everything ([`routes/sync.ts`][nn-server]).
- Because the server stores opaque encoded entities, it could not validate a write semantically without decoding CRDT records.
- This is the trade-off the model-1 systems face (§2.1). They answer it with signatures (Classic Jazz), write keys (Evolu), or a server provider that enforces read-only access (Hocuspocus).

**Multi-tab: every tab owns everything.**

- The example wires `IndexDbSync`, `BroadcastSync` and `SseSync` into every tab ([`apps/example-react/src/store.ts`][nn-app-store]).
- Every tab therefore opens its own `EventSource`, pushes every field to the server on connect, and `put`s whole roots into the same IndexedDB keys.
- The multi-tab lost-update window documented in [Persisting CRDT metadata](crdt-metadata-persistence.md) §4 is narrowed by `BroadcastSync`, because tabs merge each other's state and re-persist. It is not closed by a single owner.
- This is the Replicache, Automerge Repo and Yjs pattern: every tab writes, and BroadcastChannel notifies (§5.3).
- That pattern is sound when stored values are mergeable or keyed per writer. `@nn` writes a whole merged root per key, so correctness depends on the last `put` being a superset of the others.

**Web platform:**

- `IndexDb` sets no durability hint ([`index-db.ts`][nn-idb]), so writes complete at OS-buffer level in current browsers ([Chrome][chrome-relaxed]).
- Nothing calls `navigator.storage.persist()`, so data lives in a best-effort bucket and can be evicted whole (§5.2).
- `IndexDb.init` reacts to `versionchange` by closing and reconnecting. That is the cooperative behaviour IndexedDB requires for upgrades in other tabs ([ADR-16][adr16]).

**Schema evolution: none.**

- `IndexDb.init` only ever adds object stores for new top-level fields, by bumping the version.
- There is no schema version in storage or on the wire, and no migration hook.
- `State.merge` checks only that the incoming entity's `key` matches. It decodes by the record's own `metadata.kind` and does not compare it with the local schema ([`state.ts`][nn-state]; [`codec.ts`][nn-codec]).
- §6 shows what the field does instead: version-gated reload (Replicache, Zero), schemaless storage (PowerSync), append-only with quarantine (Evolu), log replay (LiveStore) and lenses (Jazz 2.0).

### 8.3 Gaps the research exposes

These are observations against the surveyed field, not decisions. Any of them would need an ADR.

1. **The server's copy is not a join.** The field shows three ways to close §8.2's out-of-order window:
   - the server merges (decode, `merge`, re-encode), as Automerge Repo's server does;
   - the server keeps an append-only set of pushed states and joins them on read, as Evolu's relay keeps all changes;
   - the client sequences pushes per field, the way `IndexDb.set` already does locally.
2. **No cursor or version on the wire.** Every catch-up is a full snapshot, and every edit sends a whole root. Per-root versions, such as the HLC already carried in entities, would allow `Last-Event-ID`-style resume and smaller pushes. Delta options are in [CRDT deltas](crdt-deltas.md) §8.
3. **No partial replication or read authorization.** Every surveyed server-mediated system scopes sync by the auth context (§3.4, §7.5). `@nn` has one global key.
4. **No write authorization, and no way to reject a write.** Model 1 rules out server rollback. The choices the field shows are data-level authority (signatures or write keys, see [Keyhive](keyhive.md)) or accepting a trusted server that can refuse a push. A refused push currently produces only an `onError`, and the field is re-sent on its next change.
5. **No single owner across tabs.** Each tab runs persistence and a network connection. The field's answer for single-connection or single-writer storage is a Web Lock, elected in a worker where possible, with a fallback where SharedWorker is missing (§5.3).
6. **Eviction and durability are unaddressed.** There is no `persist()` request, no durability hint, and no storage-failure path like Replicache's `StorageFailureKind` (§5.2).
7. **No schema versioning.** This is the gap with the largest blast radius for long-offline clients. A field whose CRDT kind changes, or a removed field, has no defined behaviour on merge (§6).
8. **The thesis outline already plans these topics.** [`Resources.md`][nn-resources] lists "Web workers", "Service workers", "Schema version" and "indexedb, allowse to create multiple dbs, version, userid" under the practical part. Sections 5.3–5.4 and 6 of this note are the primary-source basis for those chapters.

---

## 9. What I could not verify

These were looked for and not found in a primary source, or found only in a secondary one. They are not stated as fact above.

**Linear**

- Its client internals: IndexedDB as the store, MobX, WebSocket transport, transaction types, the rebase algorithm, `schemaHash` migrations, multi-tab handling and bootstrap formats.
  - These appear only in the third-party reverse-engineering (secondary box in §2.2).
  - Transcripts of Tuomas Artman's talks could not be retrieved: React Helsinki 2020, "Scaling the Linear Sync Engine" (2023, [summary page][lin-scaling]) and Local-First Conf. The localfirst.fm #15 transcript was read but has little protocol detail.

**Figma**

- Which browser storage, if any, holds offline edits or the cached file.
- Multi-tab behaviour, client-side schema migration beyond "adding new properties", and eviction handling.

**Replicache and Zero**

- Whether Zero tabs in one client group share a WebSocket. The code suggests one socket per instance; this was not traced end to end.
- Replicache docs never name IndexedDB; only the code does.
- Quotes from doc.replicache.dev came through a fetch tool that returns fragments of 125 characters or less. Only short fragments are quoted here.

**Electric**

- The exact meaning of the `${number}_${number}` offset.
- Whether the TS client does any multi-tab sharing. Only an absence was found by grep.
- The semantics of subquery shapes (move-in and move-out).

**PowerSync**

- Internals of the Rust core extension (`powersync-sqlite-core`). Not cloned.
- How server-side bucket reprocessing after a schema change surfaces to an offline client.

**TanStack DB**

- Whether repo docs at 1.0.0-rc.1.4 match the published site.

**Automerge Repo and Yjs**

- Whether Automerge's docs call the sync server "just another peer" in those words.
- The Automerge Repo announcement's exact date and author. The page was read through a summarizing fetch.
- Any official Yjs guidance on schema evolution.
- Whether y-indexeddb coordinates across tabs.
- Hocuspocus per-connection document multiplexing and debounce defaults. Its auth guide returned 404.
- The absence of `persist()` in Automerge Repo, the Yjs providers, Replicache and Zero rests on grep only.

**Jazz**

- Whether the Classic Jazz sync server _rejects_ transactions that fail group permissions, or only stores them for peers to discard.
- Whether Classic Jazz tabs exchange changes live without the server.
- The Jazz 2.0 docs contradict each other: `internals.mdx` says "no tab-leader election", and a FAQ in `how-jazz-works.mdx` mentions "leader or follower tabs". §5.3 follows `internals.mdx`.

**Other systems**

- **Evolu**: how `subscribeQuery` refresh works internally, beyond worker-sent patches.
- **LiveStore**: the actual conflict default, since its docs contradict each other (§2.4). Also how the Cloudflare provider orders pushes beyond the backend contract.
- **Triplit**: whether the live docs (triplit.dev returned no text to the fetch tool) match the repo, and its maintenance status. The last commit was 2025-09-10. The server's per-write permission evaluation path was also not traced.
- **InstantDB**: multi-tab data coordination, and how it chooses between WebSocket and SSE.
- **RxDB**: whether its broadcast-channel leader election uses Web Locks internally.
- **TinyBase**: tombstone garbage collection and its HLC future-offset bound.

**Web platform**

- When Chrome's `readwrite-unsafe` mode for sync access handles left trial, if it has. It is absent from the File System Standard as fetched.
- Whether the WebKit seven-day rule still applies to Home Screen web apps under current Safari. The 2020 post says they have their own counter; the 2023 post does not address it.

**This repo**

- The §8.2 out-of-order sequence is an inference from reading `SyncEngine`, `Store.onChange`, `SseSync.push` and the example server. It was not reproduced in a test.
- Whether two `fetch` POSTs from one tab can reach the example server's handler out of order in practice. That depends on the HTTP version, connection reuse and the hosting platform, none of which were tested.

---

## References

[storage]: https://storage.spec.whatwg.org/
[idb]: https://w3c.github.io/IndexedDB/
[fs]: https://fs.spec.whatwg.org/
[locks]: https://w3c.github.io/web-locks/
[html-bc]: https://html.spec.whatwg.org/multipage/web-messaging.html#broadcasting-to-other-browsing-contexts
[html-workers]: https://html.spec.whatwg.org/multipage/workers.html#shared-workers-and-the-sharedworker-interface
[sw]: https://w3c.github.io/ServiceWorker/
[buckets]: https://wicg.github.io/storage-buckets/
[webkit-2023]: https://webkit.org/blog/14403/updates-to-storage-policy/
[webkit-2020]: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
[mdn-quota]: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
[chrome-relaxed]: https://developer.chrome.com/blog/indexeddb-durability-mode-now-defaults-to-relaxed
[chrome-unsafe]: https://developer.chrome.com/blog/new-dev-trial-for-multiple-readers-and-writers
[sqlite-wasm]: https://sqlite.org/wasm/doc/trunk/persistence.md
[rep-hiw]: https://doc.replicache.dev/concepts/how-it-works
[rep-strat]: https://doc.replicache.dev/strategies/overview
[rep-push]: https://doc.replicache.dev/reference/server-push
[rep-home]: https://replicache.dev/
[zero-sync]: https://github.com/rocicorp/zero-docs/blob/22151d4a256ea42b8242ddea8c9810842ba25797/contents/docs/sync.mdx
[lin-delta]: https://linear.app/now/rebuilding-delta-sync-read-path
[lin-incident]: https://linear.app/now/linear-incident-on-jan-24th-2024
[lin-docs]: https://linear.app/docs/get-the-app
[lin-fm]: https://share.transistor.fm/s/3a91aa11/transcript.srt
[lin-scaling]: https://linear.app/now/scaling-the-linear-sync-engine
[fig-mp]: https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
[fig-rust]: https://www.figma.com/blog/rust-in-production-at-figma/
[fig-rel]: https://www.figma.com/blog/making-multiplayer-more-reliable/
[fig-lg]: https://www.figma.com/blog/livegraph-real-time-data-at-scale/
[el-next]: https://electric.ax/blog/2024/07/17/electric-next
[ps-client]: https://docs.powersync.com/architecture/client-architecture
[ps-service]: https://docs.powersync.com/architecture/powersync-service
[ps-proto]: https://docs.powersync.com/architecture/powersync-protocol
[ps-cons]: https://docs.powersync.com/architecture/consistency
[ps-write]: https://docs.powersync.com/handling-writes/writing-client-changes
[ps-conflicts]: https://docs.powersync.com/handling-writes/handling-update-conflicts
[ps-streams]: https://docs.powersync.com/sync/streams/overview
[ps-web]: https://docs.powersync.com/client-sdks/reference/javascript-web
[ps-schema]: https://docs.powersync.com/maintenance-ops/implementing-schema-changes
[am-repos]: https://automerge.org/docs/reference/repositories/
[am-net]: https://automerge.org/docs/reference/repositories/networking/
[am-storage-doc]: https://automerge.org/docs/reference/repositories/storage/
[am-blog]: https://automerge.org/blog/automerge-repo/
[yjs-docs]: https://docs.yjs.dev/
[yjs-offline]: https://docs.yjs.dev/getting-started/allowing-offline-editing
[yjs-awareness]: https://docs.yjs.dev/getting-started/adding-awareness
[hp-hooks]: https://tiptap.dev/docs/hocuspocus/server/hooks
[evo-sync]: https://github.com/evoluhq/evolu/blob/771dc6119aa6cba8325bcde2dddbdd74bc8a2074/apps/web/src/app/(docs)/docs/sync/page.mdx
[evo-privacy]: https://github.com/evoluhq/evolu/blob/771dc6119aa6cba8325bcde2dddbdd74bc8a2074/apps/web/src/app/(docs)/docs/privacy/page.mdx
[evo-schema]: https://github.com/evoluhq/evolu/blob/771dc6119aa6cba8325bcde2dddbdd74bc8a2074/apps/web/src/app/(docs)/docs/schema/page.mdx
[inst-firebase]: https://www.instantdb.com/essays/next_firebase
[inst-arch]: https://www.instantdb.com/essays/architecture
[rx-repl]: https://rxdb.info/replication.html
[tb-merge]: https://tinybase.org/guides/synchronization/using-a-mergeablestore/
[nn-store]: ../../../packages/store/src/store.ts
[nn-state]: ../../../packages/store/src/state.ts
[nn-view]: ../../../packages/store/src/projectors/view.ts
[nn-register]: ../../../packages/entities/src/lww-register.ts
[nn-codec]: ../../../packages/entities/src/codec.ts
[nn-time]: ../../../packages/time/src/time.ts
[nn-react]: ../../../packages/react/src/index.ts
[nn-engine]: ../../../packages/sync-engine/src/sync-engine.ts
[nn-session]: ../../../packages/sync-engine/src/session.ts
[nn-idbsync]: ../../../packages/indexdb-sync/src/index-db-sync.ts
[nn-idb]: ../../../packages/indexdb-sync/src/index-db.ts
[nn-sse]: ../../../packages/sse-sync/src/sse-sync.ts
[nn-bc]: ../../../packages/broadcast-sync/src/broadcast-sync.ts
[nn-server]: ../../../apps/example-react/api/_server/routes/sync.ts
[nn-memdb]: ../../../apps/example-react/api/_server/services/database/memory-database.ts
[nn-redisdb]: ../../../apps/example-react/api/_server/services/database/redis-database.ts
[nn-app-store]: ../../../apps/example-react/src/store.ts
[nn-vite]: ../../../apps/example-react/vite.config.ts
[nn-resources]: ../Resources.md
[adr14]: ../../decisions/ADR-14-ship-indexeddb-persistence-as-one-sync-engine.md
[adr15]: ../../decisions/ADR-15-stream-remote-changes-over-server-sent-events.md
[adr16]: ../../decisions/ADR-16-give-sync-engines-a-connection-lifecycle.md
[adr17]: ../../decisions/ADR-17-retry-disconnected-engines-on-wake-signals.md
[adr18]: ../../decisions/ADR-18-expose-store-and-sync-engines-through-listener-methods.md
