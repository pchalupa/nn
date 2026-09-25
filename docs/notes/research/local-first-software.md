# Local-first software: the seven ideals, CRDTs, and what the primary sources admit is unsolved

Researched 2026-09-23. Everything below comes from primary sources — Ink & Switch essays, Martin Kleppmann's own site and papers, automerge.org, the Automerge GitHub repos, localfirstweb.dev. Where a claim is third-party commentary it is flagged as such. Sources read:

- **The 2019 essay**, read in full at its canonical URL <https://www.inkandswitch.com/essay/local-first/> (the older `/local-first/` path now redirects there). Kleppmann, Wiggins, van Hardenberg, McGranaghan; also published as an Onward! 2019 paper ([PDF](https://www.inkandswitch.com/essay/local-first/local-first.pdf), [ACM 10.1145/3359591.3359737](https://dl.acm.org/doi/10.1145/3359591.3359737)).
- **JSON CRDT paper**: Kleppmann & Beresford, "A Conflict-Free Replicated JSON Datatype", IEEE TPDS 28(10):2733–2746, April 2017 — abstract read at <https://martin.kleppmann.com/2017/04/24/json-crdt.html> and <https://arxiv.org/abs/1608.03960>.
- **Columnar encoding experiment**: <https://github.com/automerge/automerge-perf/blob/master/columnar/README.md> (Kleppmann, in the `automerge-perf` repo), read in full.
- **Automerge 2.0** announcement <https://automerge.org/blog/automerge-2/>, **Automerge 3.0** <https://automerge.org/blog/automerge-3/>, **Automerge Repo** <https://automerge.org/blog/automerge-repo/>, project homepage <https://automerge.org/>.
- **Peritext** essay <https://www.inkandswitch.com/peritext/> (paper version: Litt, Lim, Kleppmann, van Hardenberg, PACMHCI 6(CSCW2) art. 531, [10.1145/3555644](https://dl.acm.org/doi/10.1145/3555644)).
- **PushPin** <https://www.inkandswitch.com/pushpin/>, **Cambria** <https://www.inkandswitch.com/cambria/>, **Upwelling** <https://www.inkandswitch.com/upwelling/>, **Patchwork notebook** <https://www.inkandswitch.com/patchwork/notebook/>, **Keyhive notebook** <https://www.inkandswitch.com/keyhive/notebook/>, essay index <https://www.inkandswitch.com/essay/>.
- **Beelay sync protocol** design doc <https://github.com/automerge/beelay/blob/main/docs/protocol.md>.
- **Kleppmann's 2024 keynote** page <https://martin.kleppmann.com/2024/05/30/local-first-conference.html>; **Move operations** paper page <https://martin.kleppmann.com/2024/04/22/json-crdt-move.html>; **Ink & Switch Dispatch 012** <https://www.inkandswitch.com/newsletter/dispatch-012/>; **localfirstweb.dev** <https://www.localfirstweb.dev/>.

Section 11 lists what I could **not** verify.

---

## 1. The core definition: an inversion of which copy is primary

The essay's own framing, quoted verbatim:

> We call this type of software local-first software, since it prioritizes the use of local storage (the disk built into your computer) and local networks (such as your home WiFi) over servers in remote datacenters.

And the actual mechanism:

> In cloud apps, the data on the server is treated as the primary, authoritative copy of the data; if a client has a copy of the data, it is merely a cache that is subordinate to the server. Any data modification must be sent to the server, otherwise it "didn't happen." In local-first applications we swap these roles: we treat the copy of the data on your local device — your laptop, tablet, or phone — as the primary copy. Servers still exist, but they hold secondary copies of your data in order to assist with access from multiple devices. As we shall see, this change in perspective has profound implications.

Note what this does **not** say: it does not say "no servers". The essay is explicit that servers keep a role — see §7 on "cloud peers".

Source: <https://www.inkandswitch.com/essay/local-first/>

---

## 2. The seven ideals, stated precisely

The essay gives seven numbered ideals, each with a heading. The headings are quoted exactly; the claim under each is the essay's own load-bearing sentence, quoted.

### 1. "No spinners: your work at your fingertips"

> Local-first software is different: because it keeps the primary copy of the data on the local device, there is never a need for the user to wait for a request to a server to complete. All operations can be handled by reading and writing files on the local disk, and data synchronization with other devices happens quietly in the background.

The claim is deliberately hedged: "While this by itself does not guarantee that the software will be fast, we expect that local-first software has the **potential** to respond near-instantaneously to user input". The argument against cloud apps is the speed of light plus the observation that Optimistic UI only hides latency until a request fails.

### 2. "Your work is not trapped on one device"

> This means that while local-first apps keep their data in local storage on each device, it is also necessary for that data to be synchronized across all of the devices on which a user does their work.

So ideal 2 is a _sync_ requirement, not a _storage_ requirement. The essay explicitly grants that most cross-device sync services also keep a server copy, which doubles as off-site backup, and that these "work quite well as long as each file is only edited by one person at a time."

### 3. "The network is optional"

> Since local-first applications store the primary copy of their data in each device's local filesystem, the user can read and write this data anytime, even while offline. It is then synchronized with other devices sometime later, when a network connection is available. The data synchronization need not necessarily go via the Internet: local-first apps could also use Bluetooth or local WiFi to sync data to nearby devices.

It adds a delivery-mechanism claim that is often forgotten: "for good offline support it is desirable for the software to run as a locally installed executable on your device, rather than a tab in a web browser."

### 4. "Seamless collaboration with your colleagues"

> In local-first apps, our ideal is to support real-time collaboration that is on par with the best cloud apps today, or better. Achieving this goal is one of the biggest challenges in realizing local-first software, but we believe it is possible.

Plus an explicitly _multi-modal_ requirement: besides real-time editing, "it is sometimes useful for one person to tentatively propose changes that can be reviewed and selectively applied by someone else" — Google Docs suggesting mode, GitHub pull requests.

### 5. "The Long Now"

> When you do some work with local-first software, your work should continue to be accessible indefinitely, even after the company that produced the software is gone.

The mechanism claimed: "your data, and the software that is needed to read and modify your data, are all stored locally on your computer." The failure mode named for cloud apps is not just shutdown but forced upgrade: "with a cloud app, continuing to use the old version is not an option — you will be upgraded whether you like it or not."

### 6. "Security and privacy by default"

> Local-first apps, on the other hand, have better privacy and security built in at the core. Your local devices store only your own data, avoiding the centralized cloud database holding everybody's data. Local-first apps can use end-to-end encryption so that any servers that store a copy of your files only hold encrypted data that they cannot read.

Two distinct arguments: no honeypot of all users' data, and E2EE so servers hold ciphertext.

### 7. "You retain ultimate ownership and control"

The essay disambiguates "ownership" carefully, and this is the part most often misquoted:

> To disambiguate "ownership" in this context: we don't mean it in the legal sense of intellectual property. […] Instead we mean ownership in the sense of user agency, autonomy, and control over data. You should be able to copy and modify data in any way, write down any thought, and no company should restrict what you are allowed to do.

And two consequences the authors state explicitly:

> With data ownership comes responsibility: maintaining backups or other preventative measures against data loss, protecting against ransomware, and general organizing and managing of file archives.

> In our opinion, maintaining control and ownership of data does not mean that the software must necessarily be open source. […] it is possible for commercial and closed-source software to satisfy the local-first ideals, as long as it does not artificially restrict what users can do with their files.

Source: <https://www.inkandswitch.com/essay/local-first/>

---

## 3. The scorecard, reproduced faithfully

The essay's own legend:

> ✓ means the technology meets the ideal, — means it partially meets the ideal, and ✗ means it does not meet the ideal.

The essay presents these as eight separate small tables (grouped into "how application architecture affects user experience" and "developer infrastructure for building apps"), not one big one. Consolidated, with the original column headings and cell values:

|                           | 1. Fast | 2. Multi-device | 3. Offline | 4. Collaboration | 5. Longevity | 6. Privacy | 7. User control |
| ------------------------- | ------- | --------------- | ---------- | ---------------- | ------------ | ---------- | --------------- |
| Files + email attachments | ✓       | —               | ✓          | ✗                | ✓            | —          | ✓               |
| Google Docs               | —       | ✓               | —          | ✓                | —            | ✗          | —               |
| Trello                    | —       | ✓               | —          | ✓                | —            | ✗          | ✗               |
| Pinterest                 | ✗       | ✓               | ✗          | ✓                | ✗            | ✗          | ✗               |
| Dropbox                   | ✓       | —               | —          | ✗                | ✓            | —          | ✓               |
| Git+GitHub                | ✓       | —               | ✓          | —                | ✓            | —          | ✓               |
| Web apps                  | ✗       | ✓               | ✗          | ✓                | ✗            | ✗          | ✗               |
| Thick client              | ✓       | —               | ✓          | ✗                | —            | ✗          | ✗               |
| Firebase, CloudKit, Realm | —       | ✓               | ✓          | —                | ✗            | ✗          | ✗               |
| CouchDB                   | —       | —               | ✓          | ✗                | —            | —          | —               |
| **???**                   | **✓**   | **✓**           | **✓**      | **✓**            | **✓**        | **✓**      | **✓**           |

The last row is the essay's own: "three years ago, our lab set out to search for a solution that gives seven green checkmarks." A final empty row labelled "Your app" appears in the "For practitioners" section as a self-scoring exercise.

The reasoning behind the more interesting rows, in the authors' words:

- **Files + email attachments** — "traditional files have many desirable properties: they can be viewed and edited offline, they give full control to users, and they can readily be backed up and preserved for the long term." The weak point is collaboration: "only one person at a time can make changes to a file, otherwise a difficult manual merge is required."
- **Dropbox** — ✓ on Fast/Longevity/User control because it watches a local folder, but only — on Multi-device and Offline because "on mobile platforms (iOS and Android), Dropbox and its cousins use a completely different model. The mobile apps do not synchronize an entire folder — instead, they are thin clients". ✗ on Collaboration: "The fact that these tools synchronize files in any format is both a strength (compatibility with any application) and a weakness (inability to perform format-specific merges)."
- **Git+GitHub** — the highest-scoring row and the only one with four ✓s. "They are perhaps the closest thing we have to a true local-first software package […] because a Git repository on your local filesystem is a primary copy of the data, and is not subordinate to any server." The — on Collaboration is precise: "Git has no capability for real-time, fine-grained collaboration"; and "Git is highly optimized for code and similar line-based text files; other file formats are treated as binary blobs".
- **Web apps** — six ✗s, the lowest row. "we speculate that web apps will never be able to provide all the local-first properties we are looking for, due to the fundamental thin-client nature of the platform. By choosing to build a web app, you are choosing the path of data belonging to you and your company, not to your users."
- **Firebase / CloudKit / Realm** — ✓ on Multi-device and Offline, "However, as a proprietary hosted service, we give it a low score for privacy and longevity." The Parse shutdown is cited as evidence for the longevity ✗.
- **CouchDB** — the most sympathetic negative verdict. "Philosophically, CouchDB is closely aligned to the local-first principles". The ✗ on Collaboration is because "these changes lead to conflicts that need to be explicitly resolved by application code. This conflict resolution code is difficult to write correctly, making CouchDB impractical for applications with very fine-grained collaboration". Verdict: "while we agree with much of the philosophy behind CouchDB, we feel that the implementation has not been able to realize the local-first vision in practice."

Source: <https://www.inkandswitch.com/essay/local-first/>

---

## 4. CRDTs as the enabling technology

### What a CRDT is, per the primary sources

The 2019 essay's definition is deliberately informal and framed around _substitution_:

> CRDTs emerged from academic computer science research in 2011. They are general-purpose data structures, like hash maps and lists, but the special thing about them is that they are multi-user from the ground up.

> If you are building a single-user application, you would maintain those data structures in memory using model objects, hash maps, lists, records/structs and the like. If you are building a collaborative multi-user application, you can swap out those data structures for CRDTs.

The essay is precise about the one case automatic merging cannot handle:

> The only type of change that a CRDT cannot automatically resolve is when multiple users concurrently update the same property of the same object; in this case, the CRDT keeps track of the conflicting values, and leaves it to be resolved by the application or the user.

And it stresses transport-independence, which is what makes the same data structure serve both Google Docs-style and Git-style workflows:

> CRDTs can sync their state via any communication channel (e.g. via a server, over a peer-to-peer connection, by Bluetooth between local devices, or even on a USB stick). The changes tracked by a CRDT can be as small as a single keystroke, enabling Google Docs-style real-time collaboration. But you could also collect a larger set of changes and send them to collaborators as a batch, more like a pull request in Git.

The essay's own recommended technical introductions are Baboulevitch's "Data Laced with History", Kleppmann's "Convergence vs Consensus" slides, Shapiro et al.'s survey, Attiya et al.'s formal specification of collaborative text editing, and Gomes et al.'s formal verification of CRDTs.

The Peritext essay gives a tighter definition and names the plain-text family:

> Conflict-free Replicated Data Types (CRDTs) are algorithms that allow each user to edit their local copy of a document, and which ensure that different users' copies can be cleanly merged into a consistent result. For plain text documents there are plenty of CRDT algorithms, such as RGA, Causal Trees, YATA, WOOT, Treedoc, Logoot, LSEQ, and various others.

Automerge's own marketing definition is the most approachable: "Automerge is a CRDT, or 'conflict-free replicated data type', but if you're allergic to buzzwords you can just think of it as a version controlled data structure."

### The JSON CRDT

Automerge is built on Kleppmann & Beresford's JSON CRDT. Verbatim abstract (IEEE TPDS 28(10):2733–2746, 2017):

> Many applications model their data in a general-purpose storage format such as JSON. This data structure is modified by the application as a result of user input. Such modifications are well understood if performed sequentially on a single copy of the data, but if the data is replicated and modified concurrently on multiple devices, it is unclear what the semantics should be. In this paper we present an algorithm and formal semantics for a JSON data structure that automatically resolves concurrent modifications such that no updates are lost, and such that all replicas converge towards the same state (a conflict-free replicated datatype or CRDT). It supports arbitrarily nested list and map types, which can be modified by insertion, deletion and assignment. The algorithm performs all merging client-side and does not depend on ordering guarantees from the network, making it suitable for deployment on mobile devices with poor network connectivity, in peer-to-peer networks, and in messaging systems with end-to-end encryption.

The 2019 essay states the lineage directly: "Ink & Switch has developed an open-source, JavaScript CRDT implementation called Automerge. It is based on our earlier research on JSON CRDTs. We have then combined Automerge with the Dat networking stack to form Hypermerge." And immediately disclaims: "We do not claim that these libraries fully realize local-first ideals — more work is still required."

A known gap in the 2017 design is **move operations**, addressed later by Liangrun Da & Kleppmann, "Extending JSON CRDTs with Move Operations" (PaPoC 2024, [10.1145/3642976.3653030](https://doi.org/10.1145/3642976.3653030)): "Moving a subtree in a map or reordering elements in a list within a JSON CRDT is challenging: naive merge algorithms may introduce unexpected results such as duplicates or cycles. […] We plan to integrate this algorithm into the Automerge CRDT library."

Sources: <https://www.inkandswitch.com/essay/local-first/>, <https://martin.kleppmann.com/2017/04/24/json-crdt.html>, <https://arxiv.org/abs/1608.03960>, <https://www.inkandswitch.com/peritext/>, <https://automerge.org/blog/automerge-2/>, <https://martin.kleppmann.com/2024/04/22/json-crdt-move.html>

---

## 5. Performance: the columnar encoding and the Automerge 2 / 3 rewrites

This is the thread the essay itself named as the most serious technical problem ("CRDTs accumulate a large change history, which creates performance problems"), and it is worth following because the numbers are dramatic.

### The columnar encoding experiment (Kleppmann, `automerge-perf`)

The starting point, in Kleppmann's words:

> The current encoding uses about 240 bytes for each inserted character, which is pretty bad given that the character itself is only 1 byte (for English text at least).

The design has two goals, and the second is the interesting one — the encoding is also meant to become the _runtime_ representation:

> a secondary goal of this experiment is to see whether it would make sense to also use packed byte arrays as Automerge's runtime data structures. The current runtime data structures […] are pretty heavyweight. […] Judicious use of byte arrays instead of pointer-heavy tree structures may have better "mechanical sympathy".

The technique: treat the operation log as a relational table (`op_id`, `op_type`, `ref`, `value`), sort rows into document order, then encode each **column** separately with LEB128 + run-length encoding + delta encoding. `op_id` counters delta-encode; actor IDs RLE; `op_type` RLE with the values omitted since there are only two; text values become one concatenated UTF-8 blob plus an RLE'd sequence of byte lengths. Kleppmann notes this is borrowed from analytic databases: "The idea of 'column-oriented' or 'columnar' encoding is well established in analytic databases such as data warehouses, but I haven't seen it used in CRDTs before." RLE is preferred over LZW specifically because some operations can be performed directly on the compressed data ("vectorized processing").

Measured on the now-standard benchmark trace — the keystroke-by-keystroke history of writing the JSON CRDT paper, 361,980 operations of which 182,315 are single-character insertions and 77,463 deletions, producing a 104,852-byte LaTeX file:

| Buffer          | Bytes       |
| --------------- | ----------- |
| OpTypes         | 15,975      |
| Text            | 182,315     |
| Lengths         | 4           |
| Operation ID    | 22,024      |
| Origins         | 41          |
| Reference count | 64,470      |
| Reference node  | 697         |
| **Total**       | **285,526** |

> That's 1.1 bytes per operation on average — a lot better than the approximately 55 bytes per operation consumed by the JSON representation […] With this compression, the encoded document (including the full keystroke-by-keystroke editing history of the document!) is only slightly larger than the uncompressed plain text file without any CRDT metadata.

The caveat, stated by the author:

> these compression benefits only kick in because we are encoding the entire document in one go. If every change is encoded separately (with only a small number operations per change) […] the compression will be less effective.

### Automerge 2.0 (2023): the Rust rewrite

Automerge 2.0 is "our first supported release resulting from a ground-up rewrite", motivated by: "Our initial implementations were theoretically sound but much too slow and used too much memory for most production use cases." Rust core, WebAssembly for JS, C bindings.

Published benchmarks on the same trace (~260k operations, Ryzen 9 7900X; "timing" is applying every edit, "memory" is peak usage):

| Insert ~260k operations  | Timing (ms) | Memory (bytes) |
| ------------------------ | ----------- | -------------- |
| Automerge 0.14           | ~500,000    | ~1,100,000,000 |
| Automerge 1.0.1          | 13,052      | 184,721,408    |
| Automerge 2.0.1          | 1,816       | 44,523,520     |
| Yjs                      | 1,074       | 10,141,696     |
| Automerge 2.0.2-unstable | 661         | 22,953,984     |

Note that Ink & Switch publish Yjs beating Automerge 2.0.1 on both axes, and Automerge only overtaking it on time (not memory) in an unstable build.

| Size on disk   | bytes       |
| -------------- | ----------- |
| plain text     | 107,121     |
| automerge 2.0  | 129,062     |
| automerge 0.14 | 146,406,415 |

> The binary format works wonders in this example, encoding a full history for the document with only 30% overhead. That's less than one additional byte per character! The naive JSON encoding often used circa Automerge 0.14 could exceed 1,300 bytes per character.

Load time for ~260k operations: 590 ms (1.0.1), 593 ms (2.0.1), 438 ms (2.0.2-unstable).

### Automerge 3.0 (2025): the compressed representation at runtime

This is the columnar experiment's second goal finally landing:

> Previous versions of Automerge already used a compressed columnar format to store and transmit this metadata. […] However, when a document was actually loaded for editing, we used an uncompressed format for the history, so the memory usage would balloon to a significantly larger overhead.
>
> In Automerge 3.0, we've rearchitected the library so that it also uses the compressed representation at runtime. […] For example, pasting Moby Dick into an Automerge 2 document consumes 700Mb of memory, in Automerge 3 it only consumes 1.3Mb!

Two consequences the post highlights: sync servers can hold many large documents in memory at once, and "we recently had an example of a document which hadn't loaded after 17 hours loading in 9 seconds!". Same file format as Automerge 2; the `Text` class is removed and collaborative strings become the default (`RawString` renamed `ImmutableString`).

Sources: <https://github.com/automerge/automerge-perf/blob/master/columnar/README.md>, <https://automerge.org/blog/automerge-2/>, <https://automerge.org/blog/automerge-3/>

---

## 6. Peritext: the rich-text problem

Peritext (2021 essay; CSCW 2022 paper) exists because the 2019 essay's "just swap your data structures for CRDTs" is not true for formatted text.

Its argument against the three obvious approaches, in the essay's own terms:

- **Markdown in a plain-text CRDT.** Control characters merge as _text_, not as intent. If Alice bolds "The fox" and Bob concurrently bolds "fox jumped", the merged Markdown is `**The **fox** jumped.**`, which renders with "fox" _not_ bold: "both users bolded the word 'fox', but in the merged result it has ended up non-bold."
- **Control characters in plain text** — same class of failure.
- **Format spans in a JSON document** — also insufficient.

The paper's core idea (per the ACM abstract): store formatting spans alongside the plaintext character sequence, anchored to _stable identifiers_ of the first and last character of each span, and derive the formatted text from the spans deterministically so concurrent operations commute.

Peritext's own stated limits, verbatim from the conclusion:

> Inline formatting is sufficient for short blocks of text like a Trello card description, but longer documents often rely on more sophisticated block elements or hierarchical formats, such as nested bullet points, which Peritext does not currently model. […] what should happen when users concurrently split, join, and move block elements?

> Another area for future exploration is moving and duplicating text within a document. If two people concurrently cut-paste the same text to different places in a document, and then further modify the pasted text, what is the most sensible outcome?

> We do not have an exhaustive set of correctness criteria for merging edits of a rich-text document, but we believe these examples can serve as a test suite characterizing desirable merging behaviors that preserve user intent.

On performance, the prototype is explicitly unoptimized — "we store each character as a separate object (which uses a lot of memory); we remember all tombstones and the history of all formatting operations" — but the essay argues Automerge's existing optimizations transfer, citing the columnar result: "Automerge's compression algorithm can store every single keystroke in the editing history of a text document at a cost of about one byte per operation."

Automerge 2.0's roadmap named Peritext integration as planned work: "In the Peritext paper by Ink & Switch we discuss an algorithm for supporting rich text with good merging accuracy, and we are planning to integrate this algorithm into Automerge."

Sources: <https://www.inkandswitch.com/peritext/>, <https://dl.acm.org/doi/10.1145/3555644>, <https://automerge.org/blog/automerge-2/>

---

## 7. What the 2019 essay itself found — including the bad news

The essay's "Findings" section reports on three prototypes (Trellis, a Kanban board; Pixelpusher, collaborative drawing; PushPin, a media canvas), evaluated by dogfooding within a five-person team plus "approximately ten external users", with the caveat "We did not follow a formal evaluation methodology, but rather took an exploratory approach."

**The positive findings:**

- "CRDT technology works." — "we were pleasantly surprised by the reliability of Automerge."
- "The user experience with offline work is splendid."
- "Developer experience is viable when combined with Functional Reactive Programming (FRP)." — the key claim being that "all of our prototypes realized real-time collaboration and full offline capability with little effort from the application developer."
- "Conflicts are not as significant a problem as we feared." — and the honest hedge attached: "in all the prototypes we developed, we found that the default merge semantics to be sufficient, and we have so far not identified any case requiring customised semantics. We hypothesise that this is the case generally, and we hope that future research will be able to further test this hypothesis."
- "URLs are a good mechanism for sharing." — with "Access permissions for documents beyond secret URLs remain an open research question."

**The negative findings, quoted as headings:**

- "Visualizing document history is important." — "Without the right tools, it can be difficult to understand how a document came to look the way it does, what versions of the document exist, or where contributions came from."
- "Peer-to-peer systems are never fully 'online' or 'offline' and it can be hard to reason about how data moves in them."
- "CRDTs accumulate a large change history, which creates performance problems." — "Performance and memory/disk usage quickly became a problem because CRDTs store all history […] These pile up, but can't easily be truncated because it's impossible to know when someone might reconnect to your shared document after six months away."
- "Network communication remains an unsolved problem." — "CRDT algorithms provide only for the merging of data, but say nothing about how different users' edits arrive on the same physical computer." On P2P specifically: "these technologies are nowhere near production-ready: NAT traversal, in particular, is unreliable".
- "Cloud servers still have their place for discovery, backup, and burst compute." This is the essay's most-forgotten conclusion and it states it plainly: **"The key difference between traditional systems and local-first systems is not an absence of servers, but a change in their responsibilities: they are in a supporting role, not the source of truth."** Servers become "cloud peers" that solve, e.g., the closed-laptop problem.

And the blunt overall caveat: "realistically, it is not yet advisable to replace a proven product like Firebase with an experimental project like Automerge in a production setting today."

The essay closes with a research agenda it hands off. For distributed-systems researchers: branching/forking/rebasing semantics ("There is little work to date on understanding the algorithms and programming models for collaboration in situations where multiple document versions and branches exist side-by-side") and schema migration without a central authority ("As there is no central database server, there is no authoritative 'current' schema for the data"). For HCI researchers: communicating connectivity when everyone is a peer, version-history UI, and permissions ("If we can't remove documents from others' computers, what does it mean to 'stop sharing' with someone?"). And a "Call for startups" for "Firebase for CRDTs", with the litmus test: "do all your customers' apps continue working in perpetuity, even if all servers are shut down?"

Source: <https://www.inkandswitch.com/essay/local-first/>

---

## 8. The follow-up projects, and what each one concluded

The Ink & Switch essay index puts these in order: Pixelpusher (2018), Local-first (2019), PushPin (2020), Cambria (2020), Peritext (2021), Upwelling (2023), Malleable Software (2025). Each of the post-2019 ones attacks one of the open problems the essay listed.

### PushPin (2020) — "Towards production-quality peer-to-peer collaboration"

Attacks the networking open problem. Goals: respond within 16 ms to local input, permit local reads and writes at all times, collaborate over any network, "not rely on any centralised services." The report says the goals were met (Automerge + Dat + React FRP + Electron), with performance coming from "splitting Automerge into a frontend and backend, running expensive operations on a background thread without blocking the user interface."

Its future-work list is the most candid inventory of what P2P local-first still lacked:

> Different versions of an application, running different data model versions, need to be able to run side-by-side and interoperate.
> Establishing direct peer-to-peer connectivity is problematic in certain common network environments.
> Distributed Hash Table side channels are a concerning source of privacy leaks.
> The PushPin implementation currently has no mechanism for determining which users' writes to a document should be accepted.
> In a P2P system, different peers may have seen different subsets of updates for a given document. How do we communicate this to users?
> PushPin currently leaves almost all data un-encrypted, requiring trust in any peer that stores your data.
> Efficient document querying and indexes are needed: there is no way to load just the titles of a collection of Automerge documents.

### Cambria (2020) — schema evolution with bidirectional lenses

Attacks the schema-migration open problem. Notable findings:

- "Interoperability requires trading off between irreconcilable design goals" — **consistency** (both sides see a meaningfully equivalent view), **conservation** (neither side operates on data it can't observe), **predictability** (the local intent of every operation is preserved). The essay works through an assignee-array example showing you cannot have all three. "Sometimes, there are no perfect options."
- "Data translations in decentralized systems should be performed on read, not on write." Write-time translation "struggled to handle new schemas getting added later on, after the write had already happened"; the final design stores "a log of raw writes in the form of the writer schema, and translate[s] between versions at read time."
- "Lenses require well-defined transformations" — the `firstName`/`lastName` → `fullName` lens "works reliably in one direction" only, so it is not really a lens.

### Upwelling (2023) — version control for writers

Attacks the branching/review open problem for prose. Findings that read as critiques of CRDTs generally:

- "Automatic merging is necessary but not sufficient." — "if 'white' is changed to 'frosty' in one draft and to 'soft' in another draft, the merged result is either 'frostysoft' or 'softfrosty.' This result requires human follow-up". And: "when a writer deletes a paragraph in one draft, while a writer in another draft makes an edit within that paragraph. With current CRDT algorithms, any inserted characters are preserved in the place where the paragraph used to be, even though the surrounding text has gone. We are exploring new CRDT algorithms that behave better in such situations."
- "It's better to avoid conflicts in the first place" — manage the social process rather than build cleverer merge algorithms.
- A serverless design has a real cost: guaranteeing "the reviewed draft is identical to the final document" requires one-merge-at-a-time, which "The Upwelling prototype currently does not enforce." One suggested fix is explicitly a server: "keep track of the latest stack on a server, and to allow writers to merge onto the stack only if approved by the server."
- History is a liability as well as an asset: "In security-sensitive situations, as when writers are working with sources whose identities they wish to protect, it could be important to elide the history of a document. […] This is a problem caused by keeping too much history". And the sharp formulation of why this is hard: "CRDTs are currently designed to guarantee that users will see the same results from the same inputs. In this case, users will want to see the same results from different inputs."

### Patchwork (ongoing) and Keyhive (ongoing)

Patchwork is the lab's current "research project investigating dynamic environments for creative work", published as a rolling notebook rather than an essay; recent notes include "Local-First Task Framework" (2026-04) and a bound "Version Control" book. Ink & Switch describe it as "the Patchwork collaboration environment that we use to do our own work inside the lab."

Keyhive attacks the access-control open problem the 2019 essay and PushPin both flagged. Three layers: **convergent capabilities** ("A new capability model appropriate for CRDTs, and sits between object- and certificate-capabilities"), **a group management CRDT** ("Self-certifying, concurrent group management complete with coordination-free revocation"), and **E2EE with causal keys**. The framing of why local-first breaks classic models:

> Object-capabilities (AKA "ocap") are "fail-stop", meaning that they intentionally stop working if there's a network partition to preserve consistency over availability. Since local-first operates under partition (e.g. offline), parts of the classic object-capability design are not suitable.

It also documents a deliberate security tradeoff: causal keys "sacrifice forward secrecy (FS) — leaking old message keys in the case of a later compromised key — but retain secrecy of concurrent and future chunks", justified because "CRDTs like Automerge require access to the entire causal history in order to render a view."

Sources: <https://www.inkandswitch.com/pushpin/>, <https://www.inkandswitch.com/cambria/>, <https://www.inkandswitch.com/upwelling/>, <https://www.inkandswitch.com/patchwork/notebook/>, <https://www.inkandswitch.com/keyhive/notebook/>, <https://www.inkandswitch.com/essay/>

---

## 9. Sync servers: the 2019 "cloud peer" idea, ten years on

### automerge-repo

The "Firebase for CRDTs" call-to-action of 2019 was answered in part by Automerge's own stack. Automerge 2.0's roadmap framed the problem honestly: "excluding network and storage from the library has left a lot of the busy-work up to application developers, and asked them to learn a lot about distributed systems just to get started."

`automerge-repo` is the answer: "Now you can simply create a repo, point it to a sync server, and get to work on your app." It ships storage and network adapters (IndexedDB, WebSocket out of the box; community WebRTC), and the project runs a public test server at `sync.automerge.org` with an explicit disclaimer: "This is not a private instance, and as an experimental service has no reliability or data safety guarantees. Basically, it's good for demos and prototyping, but run your own sync server for production uses." The docs are careful that this is not a P2P-only story: "Don't let the usage of 'peer' confuse you into thinking this is limited to peer to peer connectivity, automerge-repo works with both client-server and peer-to-peer network transports."

The known limitation, stated in the announcement: "The sync protocol currently requires that a document it is syncing be loaded into memory. This means that a sync server can struggle to handle a lot of traffic on large documents."

### Beelay — the sync protocol designed for untrusted servers

Beelay is the successor protocol, developed alongside Keyhive. Its motivation statement is the clearest primary-source articulation of the "bring your own cloud" tension:

> This sync protocol works but production use has exposed a few limitations: firstly, that running sync servers is expensive and compromises security and secondly, that applications frequently want to synchronize many documents.

> In addition, one of the appealing things about Automerge is that you don't need to trust a central server. Introducing a sync server somewhat compromises this feature — you must trust the server operator not to look at your data and to keep it secure.

Its three stated requirements:

> - Does not impose O(n) memory requirements on sync servers where n is the number of documents being synchronized
> - Allows for sync servers to operate over encrypted data to reduce the trust users have to place in sync servers
> - Provides a mechanism for efficiently determining what documents in a collection of documents have changed

Mechanism: snapshot + **RIBLT sync** (Rateless Invertible Bloom Lookup Tables, from ["Practical Rateless Set Reconciliation"](https://arxiv.org/abs/2402.02668)) to find which documents differ, then **sedimentree sync** per out-of-sync document, which "allows for compressing runs of operations in the commit DAG _and omitting their change hashes_ from the compressed runs." Because the server can't read the documents, links between documents are synced separately into "a 'reachability index' on the server. This index is a very simple CRDT."

Keyhive's notebook states the goal as an ecosystem property, not a single product: "If we want to move towards an ecosystem of interchangeable relays, minimizing trust on such relays is a must. Our approach (perhaps unsurprisingly) is to end-to-end encrypt the data, removing read access from sync servers altogether. Under this regime, sync engines are 'merely' a way to move random-looking bytes between clients."

It also names the fundamental tension honestly: "sync protocols benefit from more metadata (to efficiently calculate deltas), but cryptographic protocols aim to minimize or eliminate metadata exposure."

It introduces a fourth access level below read: "'Pull' is weaker than the more familiar 'read' and 'write' access effects: it's only the ability to retrieve bytes from the network but not decrypt or modify them."

Sources: <https://automerge.org/blog/automerge-repo/>, <https://automerge.org/blog/automerge-2/>, <https://github.com/automerge/beelay/blob/main/docs/protocol.md>, <https://www.inkandswitch.com/keyhive/notebook/>

---

## 10. Later reflections and the community

- **Kleppmann's 2024 keynote**, "The past, present, and future of local-first", Local-First Conference, Berlin, 30 May 2024. Abstract in full: "We have come a long way since my colleagues and I published the local-first essay five years ago. In this talk I'll review where the local-first idea came from, where we are now, and what I hope the local-first community can work towards in the future." Slides and video are linked from that page. **I did not read the slides or watch the video**, so I cannot report the talk's actual content — see §11.
- **localfirst.fm episode 4**, "Martin Kleppmann: CRDTs, Automerge, generic syncing servers & Bluesky" (<https://www.localfirst.fm/4>) — the title itself confirms generic sync servers as a Kleppmann theme; I did not read a transcript.
- **Peter van Hardenberg** (Ink & Switch lab director), "Local-first: the secret master plan", Local-First Conf, May 2025 — per Ink & Switch Dispatch 012: "Peter shares our vision for building collaboration tools on top of local-first infrastructure. You'll see prototypes of universal version control and malleable software, and some new demos of the Patchwork collaboration environment."
- **Local-First Conf 2025 talks on Keyhive/Beelay**: Brooklyn Zelenka, "Safe in the Keyhive: Local-first access control with E2EE and capabilities"; Alex Good, "Beelay, a (reasonably) generic encrypted sync protocol for CRDTs".
- **localfirstweb.dev** is the community hub — directory, meetups (LoFi), and Local-First Conf. Its own one-line pitch: "Experience apps that work offline, keep your data private, and sync seamlessly across your devices. Your data stays with you, not locked in the cloud." Its reading list leads with the 2019 essay.
- Kleppmann's current affiliation, from his own site: "I am an Associate Professor working on local-first software and security protocols at the University of Cambridge."
- **Automerge's current self-description** has notably dropped "CRDT" from the headline in favour of "sync engine": "Automerge is a local-first sync engine for multiplayer apps that works offline, prevents conflicts, and runs fast."

Sources: <https://martin.kleppmann.com/2024/05/30/local-first-conference.html>, <https://www.localfirst.fm/4>, <https://www.inkandswitch.com/newsletter/dispatch-012/>, <https://www.localfirstweb.dev/>, <https://automerge.org/>

---

## 11. What I could not verify

Stated explicitly rather than filled in from memory:

- **"Local-first software is easier to scale"** is _not_ an Ink & Switch or Kleppmann piece. The only match is a **third-party blog post by Elijah Potter** (<https://elijahpotter.dev/articles/local-first-software-is-easier-to-scale>), discussed on Hacker News and Lobsters. I found no essay or talk of that title on inkandswitch.com or martin.kleppmann.com. Treat any "the local-first people say it scales better" claim as commentary, not primary source. The nearest primary-source statement is Automerge 2.0's passing remark that cloud software "is expensive to scale to large audiences" — an aside, not an argument.
- **The content of Kleppmann's 2024 keynote.** I read only the abstract page. The slides (PDF) and video were not read, so I cannot report what he actually said about where local-first has and has not delivered.
- **localfirst.fm episodes.** Titles only; no transcripts read.
- **The Onward! 2019 paper vs. the web essay.** I read the web essay in full. I did not diff it against the ACM/PDF version, so I cannot confirm the paper contains an identical scorecard or identical ideal wording.
- **Shapiro et al.'s original CRDT definition** (INRIA RR-7687, 2011) — cited by the 2019 essay as recommended reading, but I did not read it, so the formal state-based/operation-based (CvRDT/CmRDT) definitions are not sourced here.
- **Project Cambria's current status** and whether the Cambria/Automerge integration shipped — the essay describes a prototype integration (Appendix II) and I did not check the repo state.
- **Whether Peritext has been integrated into Automerge.** Automerge 2.0 (2023) said it was planned; Automerge 3.0 (2025) does not mention it. I did not check the Automerge source to see whether it landed.
- **Whether the move-operations algorithm** from the 2024 PaPoC paper has been merged into Automerge. The paper says "We plan to integrate"; I did not verify.
- **Malleable Software (2025)** and **Embark (2023)** — listed in the essay index but not read.

---

## 12. What this actually means if you build on it

Distilled from the sources above, not opinion added on top:

- **"Local-first" is a scorecard, not a binary.** The essay grades ten existing technologies with ✓/—/✗ across seven axes and scores _none_ of them 7/7. Git+GitHub, the best existing row, still gets — on collaboration and privacy and — on multi-device. Applying the scorecard to your own app is the essay's own suggested exercise.
- **Servers are not the enemy; server-as-source-of-truth is.** "The key difference between traditional systems and local-first systems is not an absence of servers, but a change in their responsibilities." Six years of follow-up work (automerge-repo's sync server, Beelay's explicit sync-server-centric design) went _toward_ servers, not away from them — but toward servers that cannot read your data.
- **History is the cost centre.** Every performance milestone in the Automerge line — columnar encoding (240 → ~1.1 bytes/op), Automerge 2.0's Rust rewrite (~500s → 1.8s on the 260k-op trace), Automerge 3.0's compressed runtime representation (700 MB → 1.3 MB for Moby Dick) — is about making "store every keystroke forever" affordable. It is now affordable; it was not in 2019, and the 2019 essay said so.
- **Automatic merge is necessary but not sufficient, by the authors' own repeated admission.** Peritext exists because naive CRDTs mangle rich-text intent; Upwelling concluded that "frostysoft" needs human review and that avoiding conflicts socially beats resolving them algorithmically; Cambria concluded that consistency, conservation and predictability cannot all be satisfied at once across schema versions.
- **The unsolved list is stable across six years:** access control and revocation without a central authority (Keyhive, still pre-alpha), branching/merging semantics beyond a single linear document, schema evolution without an authoritative schema, history redaction, and communicating version state to users. The 2019 essay named all five; the 2025 notebooks are still working on them.

---

## References

**The essay and its paper form**

- Kleppmann, Wiggins, van Hardenberg, McGranaghan, "Local-first software: You own your data, in spite of the cloud" — <https://www.inkandswitch.com/essay/local-first/>
- PDF (Onward! 2019) — <https://www.inkandswitch.com/essay/local-first/local-first.pdf> · ACM — <https://dl.acm.org/doi/10.1145/3359591.3359737>

**CRDT papers**

- Kleppmann & Beresford, "A Conflict-Free Replicated JSON Datatype", IEEE TPDS 28(10), 2017 — <https://martin.kleppmann.com/2017/04/24/json-crdt.html> · <https://arxiv.org/abs/1608.03960>
- Litt, Lim, Kleppmann, van Hardenberg, "Peritext: A CRDT for Collaborative Rich Text Editing", PACMHCI 6(CSCW2) art. 531, 2022 — <https://dl.acm.org/doi/10.1145/3555644> · <https://www.inkandswitch.com/peritext/static/cscw-publication.pdf>
- Da & Kleppmann, "Extending JSON CRDTs with Move Operations", PaPoC 2024 — <https://martin.kleppmann.com/2024/04/22/json-crdt-move.html>

**Automerge**

- Columnar encoding experiment — <https://github.com/automerge/automerge-perf/blob/master/columnar/README.md>
- Automerge 2.0 — <https://automerge.org/blog/automerge-2/>
- Automerge Repo — <https://automerge.org/blog/automerge-repo/>
- Automerge 3.0 — <https://automerge.org/blog/automerge-3/>
- Project homepage — <https://automerge.org/>
- Beelay protocol design — <https://github.com/automerge/beelay/blob/main/docs/protocol.md>

**Ink & Switch projects**

- Essay index — <https://www.inkandswitch.com/essay/>
- Peritext — <https://www.inkandswitch.com/peritext/>
- PushPin — <https://www.inkandswitch.com/pushpin/>
- Cambria — <https://www.inkandswitch.com/cambria/>
- Upwelling — <https://www.inkandswitch.com/upwelling/>
- Patchwork notebook — <https://www.inkandswitch.com/patchwork/notebook/>
- Keyhive notebook — <https://www.inkandswitch.com/keyhive/notebook/>
- Dispatch 012 (Jul 2025) — <https://www.inkandswitch.com/newsletter/dispatch-012/>

**Talks and community**

- Kleppmann keynote, "The past, present, and future of local-first", Local-First Conf 2024 — <https://martin.kleppmann.com/2024/05/30/local-first-conference.html>
- localfirst.fm #4, Kleppmann — <https://www.localfirst.fm/4>
- localfirstweb.dev — <https://www.localfirstweb.dev/>

**Commentary, explicitly not primary**

- Elijah Potter, "Local-First Software Is Easier to Scale" — <https://elijahpotter.dev/articles/local-first-software-is-easier-to-scale>
