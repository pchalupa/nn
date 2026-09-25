# Local-First Architecture in the Context of Web Application

[Assignment](Local-First%20Architecture%20in%20the%20Context%20of%20Web%20App/Assignment%201261ae89e35c8033b0cbe85f31a24108.md)

# Structure

- Introduction
- Theoretical part
  - Key principles of local-first software
  - CRDTs
    - LWW-Map
    - G-Set
  - Clock
    - Describe why physical time is not suitable for these systems
    - hybrid logical clocks
  - Replication
    - Leader-folower topology
  - Consistency
    - X consistency
    - Strongly consistency
  - Sync Engine
  - Data Ownership
  - Unique id
- Practical part
  - persistence
    - indexedb, allowse to create multiple dbs, version, userid
  - Web workers
  - Service workers
  - SPA

# Notes

- Introduction with comparism on traditional data fetching and accessing the db, Why the DB cant be on the client side?
- Schema
- Storage adapter, indexdb, flatfile
- Replication
- Query
- Schema version
- Private data, hashed
- Client, react client

Cíle

- Webový projekt který bude local-first CRUD oeprace
- Distribuovatelná knihovna

---

# Resources

Grouped by thesis topic. Entries with indented bullets are ones I have already read and taken notes on; entries without them are still unread. Duplicates from the original list have been merged.

## 1. Local-first principles and vision

- [Local-first software (Ink & Switch)](https://www.inkandswitch.com/)
- [The web after tomorrow — tonsky.me](https://tonsky.me/blog/the-web-after-tomorrow/)
  - Holy grail of the web
  - Directly connect to the data source
  - Local first holy grail of the web
- [What is local-first? (talk, playlist #1)](https://www.youtube.com/watch?v=NMq0vncHJvU&list=PL4isNRKAwz2O9FxP97_EbOivIWWwSWt5j)
  - CRD is just one tech to create local first software
  - local first is something more then offline-first, 7 ideals
  - local-first definition
    - Avability of the another computer should never prevent you from working. It should never block the user.
    - If it is local only, it is not a local-first. Local fisrt is not only local, it is multi device, syncyng has to happening
    - It should continue working offline
    - Software should keep working even if the provider closes business. Robustnost not only of network but also company
  - Leslie Lamport, distributed system
  - Software should be resilient of creator
  - peer-to-peer sync, selfhosting of sync server, store data on icloud, dropbox, generic syncing service
  - two device has to be online in order tohave peer to peer connection
  - Using local network when it is available
  - Benefits
    - No backend engineering
    - No more handling network
    - Easier, faster
    - Remove sass
- [localfirst.fm — intro episode](https://podcasts.apple.com/cz/podcast/localfirst-fm/id1725721050?i=1000641612208)
  - telephone is just vague brick without internet
  - JSON CRDTs
  - software that comes form cloud once it is gone it is gone
  - if the company is down app still lives
  - localfirst software is that it runs on your compoter and allows you to colaborate with others
  - Tick checkbox involves multiple computers, api gatewaz, api server, database
  - Cache application pwa or install download data
  - Caching is fine for read only apps
  - When you write only for you, you can cache and once internet is available send it
  - When you need colaborate, then you need conflict solving
  - Lww requires timestamp, distributed systems problem
  - CRDTs
  - your works should be able to synchronize with your devices
  - network is optional
  - users retain ovnership and control
  - permission control
  - cross app colaboration
- [History of local-first (talk)](https://www.youtube.com/watch?v=qo5m92-9_QI)
  - history
    - old-school pre cloud no colab, cloud era, local first era
    - data that you want to keep home
- [File over app — rishikeshs.com](https://rishikeshs.com/file-over-app/)
  - File over the app, "if you want to create digital artifacts that last, they must be files you can control, in formats that are easy to retrieve and read"
  - files longevity
- [localfirst.fm — malleable software / data ownership](https://podcasts.apple.com/cz/podcast/localfirst-fm/id1725721050?i=1000645311714)
  - enable colaboration across diverse tools
  - Malleable software
  - longevitiy of data
  - what data i produce that is by default mine
  - Arbitration line betweeb app data and ui state
  - Ephemeral state and shared state
  - Dont expose intermidiate state, no loading, on next frame data are updated
  - Riffl
  - Expose good abstractions to web decelopery
  - Phd thesis
- [localfirst.fm — offline-first vs local-first](https://podcasts.apple.com/cz/podcast/localfirst-fm/id1725721050?i=1000647438657)
  - Mark shepiro crdts paper
  - Male sw bit less cloud dominated
  - Companny interest to collect users data
  - Crdts
  - Merge behavior
  - Automerge
  - Ruat implementation
  - Crdts
    - Merging algorithms
    - How to make merge good, what is expected
    - Make algorithm fast
    - Automerge library
  - Crdt for json data
  - Udit delete, what should be result
  - Counter is not usefultext formatting separate feateure
  - Doing udo well
  - Editing history
  - Move operation
  - Synchorine only thouse what are change
  - Close to database
  - Json data model
  - Client oriented database
  - Data framework
  - No auth
  - E2e encryption
  - Sync peotocol
  - Sync provider for local first ecosystem
  - Use p2p only when it is available, combination of cloud and p2p
  - Move buisness logic to client, no app code on the server
  - Data storage can generic
  - Custom sync protocol
  - Offline first
    - Local first do more
    - Locl first data is yours and you can take then elswhere
    - No ownership on data
  - Pirate sw peoblem, sass solved
- [localfirst.fm — quality software](https://podcasts.apple.com/cz/podcast/localfirst-fm/id1725721050?i=1000650494989)
  - If you disconnect ftom the internet they keep working
  - Figma is hybrid model
  - List with key values, get index, get first, istead of db
  - Start simple with key value store
  - How to make web better
  - If i care for quality
  - Write web apps in different way
  - Resolution only in miliseconds
  - software that feels good
- [Syntax podcast — local-first episode](https://podcasts.apple.com/cz/podcast/syntax-tasty-web-development-treats/id1253186678?i=1000648205910)
  - Wy.js
  - Add CRDTs to structure
  - [CRDTs for mortals talk](https://www.youtube.com/watch?v=DEcwa68f-jY)
  - IndexDB instead of SQLlite
  - Localfirst.dev
  - Replicache
  - Web container
- [devtools.fm — cozy web apps, Maggie Appleton article](https://podcasts.apple.com/cz/podcast/devtools-fm-developer-tools-open-source-software-development/id1566647758?i=1000716029406)
- [localfirstacademy.com](https://localfirstacademy.com/)
- [Talk — 3f9tbqSIm-E](https://www.youtube.com/watch?v=3f9tbqSIm-E)
- [Talk — jejdismRnKQ](https://www.youtube.com/watch?v=jejdismRnKQ)
- [Talk — LqZp57NLSiU (live)](https://www.youtube.com/live/LqZp57NLSiU?si=ik7ADy5vo_2VgywG)
- [Talk — x7drE24geUw](https://youtu.be/x7drE24geUw?si=WdWsHQmY56ZfMyeE)
- [Talk — M8-WFTjZoA0](https://youtu.be/M8-WFTjZoA0?si=bayxJuSAHQdrTZ3j)
- [Talk — B5NULPSiOGw](https://youtu.be/B5NULPSiOGw?si=Dnvnko735RfN6ouv)
- [bit.ly/2DMk0AD](https://bit.ly/2DMk0AD)

## 2. CRDTs

### Theory and papers

- [Strong eventual consistency and CRDTs (Microsoft Research talk)](https://www.microsoft.com/en-us/research/video/strong-eventual-consistency-and-conflict-free-replicated-data-types/)
- [Shapiro et al. — A comprehensive study of CRDTs (INRIA)](https://inria.hal.science/hal-00932836/document)
- [arXiv 2409.14252](https://arxiv.org/abs/2409.14252)
- [arXiv 1805.06358](http://arxiv.org/pdf/1805.06358)
- [Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types (YATA)](https://www.researchgate.net/publication/310212186_Near_Real-Time_Peer-to-Peer_Shared_Editing_on_Extensible_Data_Types)
  - YATA new approach
  - Near real time
  - OT
- [RGA CRDT — ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0743731510002716)
- [Byzantine eventual consistency and local-first access control (slides)](https://speakerdeck.com/ept/byzantine-eventual-consistency-and-local-first-access-control)
  - Byzantine eventual consistency
  - Sign operation with private key
  - Every member sign a operation, leaves a record that it is a member
- [Operational transformations as an algorithm for automatic conflict resolution](https://medium.com/coinmonks/operational-transformations-as-an-algorithm-for-automatic-conflict-resolution-3bf8920ea447)
  - CDC
    - Darabae emits an event with op and before afrer

### Explainers and catalogues

- [crdt.tech](https://crdt.tech/)
- [An interactive intro to CRDTs — jakelazaroff.com](https://jakelazaroff.com/words/an-interactive-intro-to-crdts/)
- [CRDTs for mortals (talk)](https://www.youtube.com/watch?v=DEcwa68f-jY)
  - syncing is hard
  - local first apps are distributed systems
  - multiple instances of your apps on multiple devices
  - actual app
  - mongodb ish query
  - 5-10MB database
  - syncing has to be layer over databse
  - different order
  - eventual consistency
  - vector clocks
  - hybrid logical clocks, generate on device, can be serialized
  - realtive ordering
  - manual conflict resolvers are hard
  - CRDTs are commuatative (order does not change result) idempotent (doest care how many times you apply changes, always same result)
  - LWW-Map, last write wins map
  - G-Set, grow only set, cant be removed
  - sqldatabase s gse of lww maps
  - messages table, all meseges that client received
  - Read directly form DB
  - Write proxy creates messages and write to DB
  - ensuring consistency merkle tree, end to end encryption
- [LWW register — lars.hupel.info](https://lars.hupel.info/topics/crdt/07-deletion/)
- [the-algorithms.com — CRDT category](https://the-algorithms.com/category/crdt)
- [awesome-crdt](https://github.com/alangibson/awesome-crdt)

### Implementations

- [Automerge](https://automerge.org/)
- [automerge-wasm](https://github.com/automerge/automerge/tree/main/rust/automerge-wasm)
  - Eventual consistency
- [Automerge — merge rules](https://automerge.org/docs/under-the-hood/merge_rules/)
- [Loro v1.0 — CRDT](https://loro.dev/blog/v1.0)
  - directed acyclic graph (DAG)

    ![Screenshot 2024-10-23 at 20.46.49.png](Local-First%20Architecture%20in%20the%20Context%20of%20Web%20App/Screenshot_2024-10-23_at_20.46.49.png)

- [eg-walker-reference (josephg)](https://github.com/josephg/eg-walker-reference)
- [crdt-examples (Horusiath)](https://github.com/Horusiath/crdt-examples)
- [librdx — RDXJ.md](https://github.com/gritzko/librdx/blob/master/RDXJ.md)
- [fractional-indexing (rocicorp)](https://github.com/rocicorp/fractional-indexing)

## 3. Clocks, time and ordering

- [Hybrid logical clocks — cse.buffalo.edu tech report](https://cse.buffalo.edu/tech-reports/2014-04.pdf)
  - Fits into 64bits
  - Receive, send, local events
  - Assign timestamp to each event
  - Causality detection
  - Self stabilization
  - Prevention in case of HLC to be too diferent
  - l conatins 48 bits of pt
  - 16 bits for c
  - c for case when l is the same, then incerement counter
  - c can grow to 65536
- [Hybrid logical clocks — sergeiturukin.com](https://sergeiturukin.com/2017/06/26/hybrid-logical-clocks.html)
  - ordering of events
    - transitivity, antisymmetry
  - Partial order
- [Hybrid logical clocks — sookocheff.com](https://sookocheff.com/post/time/hybrid-logical-clocks/)
- [Hybrid logical clocks — muratbuffalo.blogspot.com](https://muratbuffalo.blogspot.com/2014/07/hybrid-logical-clocks.html)
- [Hybrid logical clocks — jaredforsyth.com](https://jaredforsyth.com/posts/hybrid-logical-clocks/)
- [timestamp.js — crdt-example-app_annotated](https://github.com/clintharris/crdt-example-app_annotated/blob/master/shared/timestamp.js)
- [Partial order vs total order in simple terms — Quora](https://www.quora.com/How-can-you-explain-partial-order-and-total-order-in-simple-terms)

## 4. Consistency, replication and distributed systems

- [Jepsen — consistency models](https://jepsen.io/consistency)
- [Jepsen — causal consistency](https://jepsen.io/consistency/models/causal)
- [Consistency, availability and convergence (Cornell)](https://www.cs.cornell.edu/lorenzo/papers/cac-tr.pdf)
- [Dynamo — Amazon (SOSP 2007)](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf)
- [Bigtable (Google) — NoSQL](https://static.googleusercontent.com/media/research.google.com/cs//archive/bigtable-osdi06.pdf)
- [S3 strong consistency — allthingsdistributed](https://www.allthingsdistributed.com/2021/04/s3-strong-consistency.html)
- [Patterns of distributed systems (O'Reilly)](https://www.oreilly.com/library/view/patterns-of-distributed/9780138222246/)
- [CMU 15-445 — Database systems (Fall 2024)](https://15445.courses.cs.cmu.edu/fall2024/)
- [Hasura — live queries architecture](https://github.com/hasura/graphql-engine/blob/master/architecture/live-queries.md)
- [Merklix trees — decomposition.al](https://decomposition.al/blog/2019/05/31/how-i-learned-about-merklix-trees-without-having-to-become-a-cryptocurrency-enthusiast/)
- [localfirst.fm — consistency checking](https://podcasts.apple.com/cz/podcast/localfirst-fm/id1725721050?i=1000703587516)
  - Consistency check
    - allows to find where data are incosinsten
    - aims to zero inconsistency

## 5. Sync engines

- [Are sync engines the future of web applications? — dev.to](https://dev.to/isaachagoel/are-sync-engines-the-future-of-web-applications-1bbi)
- [Local-first / sync engine reading list (gist, pesterhazy)](https://gist.github.com/pesterhazy/3e039677f2e314cb77ffe3497ebca07b)
- [A graph-based firebase — stopa.io/post/279](https://stopa.io/post/279)
  - Compares fetching with db actions
  - APIs are just a glue code between database and client
  - Facts that evolve an internal database based on them
  - Database in browser acting as a node
  - last-write wins
  - facts based system
  - **Reactivity**, notify the client about changes
  - Real language to express rules
  - Firebase mongo, Supabase Postgress
  - Define permissions rule on entities, User: {view: [ifAdmin, ifUser], write: [ifAdmin]]
  - undo and redo actions
  - Datomic, fact-based database, see changes over time, Datascript
- [How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
- [How is Linear so fast — the sync engine](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown#the-sync-engine)
- [reverse-linear-sync-engine (wzhudev)](https://github.com/wzhudev/reverse-linear-sync-engine)
- [simple-sync-engine (bholmesdev)](https://github.com/bholmesdev/simple-sync-engine)
- [budget-buddy-experimental-sync (sorenbs)](https://github.com/sorenbs/budget-buddy-experimental-sync)
- [Benefits of sync (talk, playlist #2)](https://www.youtube.com/watch?v=VLgmjzERT08&list=PL4isNRKAwz2O9FxP97_EbOivIWWwSWt5j&index=2)
  - Benefist of sync
    - performance, realine, offline
    - great developer productivity
  - lazy hidration, once you touch the sync pull the data
  - mutations, just update the data and call save
  - prototype without backend
- [Talk (playlist #6)](https://www.youtube.com/watch?v=uJLr8L-D9LE&list=PL4isNRKAwz2O9FxP97_EbOivIWWwSWt5j&index=6)
  - stable client key every time
- [localfirst.fm — partial replication / scaling](https://podcasts.apple.com/cz/podcast/localfirst-fm/id1725721050?i=1000649062065)
  - Client cant hold all the data i need only portion of data
  - Imperative call api to render ui
  - Shift from imperative to declaritive give me data sync engine
  - Global reactivivity, updates everything thancares
  - Acoid endless asking if something new
  - Scaling to milions
- [localfirst.fm — distributed state and auth](https://podcasts.apple.com/cz/podcast/localfirst-fm/id1725721050?i=1000674147209)
  - Handle also autH and permissions
  - Client public key, crypto data
  - Distributed state
  - Distributed database
  - Coolocate most accesed data
- [localfirst.fm — event sourcing](https://podcasts.apple.com/cz/podcast/localfirst-fm/id1725721050?i=1000658773975)
  - Event sourcing, event log, rewind
- [Talk — 5mn3EpWCcJs (live)](https://www.youtube.com/live/5mn3EpWCcJs?t=2356s)

## 6. Client-side databases and queries

- [The REPL, episode 55 — local-first databases](https://www.therepl.net/episodes/55/?utm_source=localfirstnews&utm_medium=email&utm_campaign=20241031)
  - A lot of problems are just database problewms
  - Replace use state with use query
  - Write-ahead log on postgress
  - Datalog database
  - Database on the client
  - Graph database to express relationships
  - EAV model
  - Giant table of EAVs
  - Topics
  - Dayasceipt
  - Semi-local-first
  - Instan oss lib
  - Browsers are more capable, we need different infrastructure, different apps
  - Permissions on object level
    - CEL https://cel.dev/
  - Gql inspired queries
  - Postgress partial indexes
  - write obejct and infer types like zod
- [Riffle — prelude](https://riffle.systems/essays/prelude/)
- [LiveStore — local-first application development (Expo blog)](https://expo.dev/blog/local-first-application-development-with-livestore)
  - Write log, all mitations are stored and replicated and applied
  - Using sql lite the rest is TS!
- [LinearLite on LiveStore (demo)](https://linearlite.livestore.dev/?status=todo,in_progress)
- [Evolu](https://github.com/evoluhq/evolu)
- [Dexie.js](https://github.com/dexie/Dexie.js)
- [idb (jakearchibald)](https://github.com/jakearchibald/idb)
- [NextGraph — docs](https://docs.nextgraph.org/en/introduction/)

## 7. Browser platform: storage, workers, tabs

- [The offline cookbook — jakearchibald.com](https://jakearchibald.com/2014/offline-cookbook/)
- [localfirst.fm — web platform, schema migrations, tabs](https://podcasts.apple.com/cz/podcast/localfirst-fm/id1725721050?i=1000643521602)
  - What native apps require, storage, db, ui
  - Web is not only dump client
  - Web is permission less
  - Why web apps dont feel native
  - old version in different tab, share storage
  - schema migration
  - schema version
  - fork database to support old version
  - sync between tabs
  - Incremental computation, i have function input changes a littbe bit, how to get result without computation
- [localfirst.fm — SQLite, OPFS, merkle trees](https://podcasts.apple.com/cz/podcast/localfirst-fm/id1725721050?i=1000651879273)
  - call update to genereate crdt message
  - Lww requires hlc, distribudet system, copy of the app and data on multiple devices
  - Merkle tree, everythink is hashed, avery leaf is hash, check if message has been hashed, 5 minutes windows depth,
  - Sqĺite stores on blocks to not load while db to memory, can be usednfor the index db, read only differen blocks
  - Indexev locking mechanism
  - Opfs private storage web api
  - Webaswmbly sync c methods problem canot await, asynchronify utility
  - Not overuse async
- [localfirst.fm — devtools](https://podcasts.apple.com/cz/podcast/localfirst-fm/id1725721050?i=1000656269230)
  - Devtools requires dara inspector
- [localfirst.fm — export/import formats](https://podcasts.apple.com/cz/podcast/localfirst-fm/id1725721050?i=1000654318065)
  - Obsidian json format for export import
- [IDBSideSync (clintharris)](https://github.com/clintharris/IDBSideSync)

## 8. Auth, permissions and encryption

- [Local-first auth — herbcaudill.com](https://herbcaudill.com/words/20240602-local-first-auth)
- [E2E encryption / sync talk — sshvBCK5NDs](https://www.youtube.com/watch?v=sshvBCK5NDs)
  - Delegate authority to one of your peers introduces complexity
  - End-to-end encryption
  - iifs
  - cursor last point in time when the client was synced with the server
  - slim thread, manifest of the thread and critical data, solves problem with hudge emails
  - skiff open source
- [localfirst.fm — UCAN, capabilities](https://podcasts.apple.com/cz/podcast/localfirst-fm/id1725721050?i=1000683929450)
  - Auth system acl
  - UCAN
  - Certificate to resource
  - Capabilities system
  - E2E encryption, do you have key to read this data?
  - Seeiment tree returns only the chunks you need biggest ones
  - Check paper ho sync works
  - Name resolving, using email, validate
- [localfirst.fm — identity](https://podcasts.apple.com/cz/podcast/localfirst-fm/id1725721050?i=1000695854199)
  - Operantional transfer shadjs
  - Bluesky identity system
- [Ink & Switch — Beehive notebook](https://www.inkandswitch.com/beehive/notebook/)
- [WebAuthn random blob (Replit)](https://replit.com/@masonicboom/WebAuthnRandomBlob#client/src/lib/webauthn.ts)
  - WebAuth with passkeys
- [CEL — Common Expression Language](https://cel.dev/)

## 9. Reference implementations and tutorials

- [crdt-example-app_annotated (clintharris)](https://github.com/clintharris/crdt-example-app_annotated)
- [crdt-example-app_annotated — NOTES.md](https://github.com/clintharris/crdt-example-app_annotated/blob/master/NOTES.md)
  - merkle tree for messages and difffing
- [Calories tracker, local-only app course — typeonce.dev](https://www.typeonce.dev/course/calories-tracker-local-only-app)

## 10. Library design (for the practical part)

- Schema.js lib bachelor thesis Fabian hiller valipod, modular arch valibot

---

![image.png](Local-First%20Architecture%20in%20the%20Context%20of%20Web%20App/image.png)
